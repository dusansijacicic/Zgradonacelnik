-- Migration 0010: bezbednost (RLS rupe), registracija (godište + adresa), Google adrese,
-- registar upravnika (sinhronizacija bez brisanja), preuzimanje registra, ponude upravnika,
-- porudžbine pretplata, audit finansija preko triggera.
--
-- Pokreni posle 0001–0009. Idempotentno gde je moguće.

-- =============================================================================
-- 0. Pomoćne funkcije
-- =============================================================================

-- Da li je trenutni zahtev "običan" korisnik (PostgREST anon/authenticated), a ne
-- service_role / SQL editor / migracija. Triggeri ispod ograničavaju samo obične korisnike.
create or replace function public.is_end_user_request()
returns boolean
language sql
stable
as $$
  select current_user in ('anon', 'authenticated')
$$;

-- =============================================================================
-- 1. user_profiles: godište, kućna adresa, veza sa registrom + zaštita kolona
-- =============================================================================

alter table public.user_profiles
  add column if not exists birth_year smallint,
  add column if not exists home_building_id uuid references public.buildings(id) on delete set null,
  add column if not exists registry_id bigint references public.professional_manager_registry(id) on delete set null;

alter table public.user_profiles drop constraint if exists user_profiles_birth_year_chk;
alter table public.user_profiles
  add constraint user_profiles_birth_year_chk check (birth_year is null or birth_year between 1900 and 2100);

-- Jedan red registra = najviše jedan nalog na platformi.
create unique index if not exists user_profiles_registry_id_uidx
  on public.user_profiles (registry_id) where registry_id is not null;

-- Postojeći korisnici bez godišta/adrese moraju ponovo kroz onboarding (MVP, pre lansiranja).
update public.user_profiles
set onboarding_completed = false
where onboarding_completed = true
  and (birth_year is null or home_building_id is null)
  and is_admin = false;

create or replace function public.protect_user_profile_columns()
returns trigger
language plpgsql
-- SECURITY INVOKER namerno: current_user mora biti uloga iz zahteva (anon/authenticated).
set search_path = public
as $$
begin
  if not public.is_end_user_request() or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_admin := false;
    new.professional_manager_status := 'not_requested';
    if new.user_type = 'professional_manager' then
      new.user_type := 'resident';
    end if;
    new.registry_id := null;
    new.google_phone_raw := null;
    new.google_phone_normalized := null;
    new.google_identity_synced_at := null;
    new.onboarding_completed := false;
    return new;
  end if;

  -- UPDATE
  if new.is_admin is distinct from old.is_admin
     or new.professional_manager_status is distinct from old.professional_manager_status
     or new.registry_id is distinct from old.registry_id
     or new.google_phone_raw is distinct from old.google_phone_raw
     or new.google_phone_normalized is distinct from old.google_phone_normalized
     or new.google_identity_synced_at is distinct from old.google_identity_synced_at
     or new.user_id is distinct from old.user_id then
    raise exception 'protected_profile_column' using errcode = '42501';
  end if;

  -- Tip "profesionalni upravnik" dodeljuje samo server posle verifikacije.
  if new.user_type is distinct from old.user_type
     and (new.user_type = 'professional_manager' or old.user_type = 'professional_manager') then
    raise exception 'protected_profile_column' using errcode = '42501';
  end if;

  -- Onboarding se ne može "preskočiti" direktnim API pozivom.
  if new.onboarding_completed and not coalesce(old.onboarding_completed, false)
     and (nullif(btrim(coalesce(new.first_name, '')), '') is null
          or nullif(btrim(coalesce(new.last_name, '')), '') is null
          or new.birth_year is null
          or new.home_building_id is null) then
    raise exception 'onboarding_incomplete' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_protect on public.user_profiles;
create trigger trg_user_profiles_protect
before insert or update on public.user_profiles
for each row execute function public.protect_user_profile_columns();

-- Javni (bezbedni) podaci o upravnicima — user_profiles je inače vidljiv samo vlasniku.
create or replace view public.manager_public_profiles as
select
  p.user_id,
  coalesce(
    nullif(btrim(p.display_name), ''),
    nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
    'Upravnik'
  ) as display_name,
  p.city,
  p.municipality,
  p.professional_manager_status,
  p.registry_id,
  p.created_at
from public.user_profiles p
where p.user_type = 'professional_manager';

grant select on public.manager_public_profiles to anon, authenticated;

-- =============================================================================
-- 2. Registar upravnika: stabilan ključ, aktivnost, pozivi, odjava
-- =============================================================================

alter table public.professional_manager_registry
  add column if not exists registry_key text,
  add column if not exists registry_status text,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamptz,
  add column if not exists removed_at timestamptz,
  add column if not exists invited_at timestamptz,
  add column if not exists invite_count int not null default 0,
  add column if not exists email_opt_out boolean not null default false;

-- Backfill ključa: licenca > email > ime+mesto; duplikati dobijaju sufiks id-a.
with keyed as (
  select
    id,
    coalesce(
      case when nullif(btrim(license_number), '') is not null then 'lic:' || btrim(license_number) end,
      case when normalized_email is not null then 'email:' || lower(normalized_email::text) end,
      'name:' || public.normalize_text(full_name) || '|' || public.normalize_text(coalesce(municipality, ''))
    ) as k
  from public.professional_manager_registry
  where registry_key is null
),
ranked as (
  select id, k, row_number() over (partition by k order by id) as rn from keyed
)
update public.professional_manager_registry r
set registry_key = case when ranked.rn = 1 then ranked.k else ranked.k || ':' || r.id end
from ranked
where ranked.id = r.id;

-- Status iz Solidus/PKS izvoza ("Registrovan" / "Obrisan iz registra").
update public.professional_manager_registry
set registry_status = nullif(raw_data->>'_solidus_status', '')
where registry_status is null and raw_data ? '_solidus_status';

update public.professional_manager_registry
set is_active = false, removed_at = coalesce(removed_at, now())
where registry_status is not null and registry_status <> 'Registrovan' and is_active;

create unique index if not exists pm_registry_key_uidx on public.professional_manager_registry (registry_key);
create index if not exists pm_registry_active_idx on public.professional_manager_registry (is_active);

-- =============================================================================
-- 3. Verifikacija upravnika: upis samo preko servera
-- =============================================================================

drop policy if exists "mvr: insert own" on public.manager_verification_requests;
drop policy if exists "mvr: update own pending fields or admin" on public.manager_verification_requests;

create policy "mvr: update by admin"
on public.manager_verification_requests
for update
using (public.is_admin())
with check (public.is_admin());

-- Preuzimanje reda iz registra: veže nalog, prebacuje recenzije/dodele vezane za registar.
-- Poziva ga samo server (service_role) posle dokazane kontrole nad email adresom iz registra.
create or replace function public.claim_registry_entry(p_user_id uuid, p_registry_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.user_profiles where registry_id = p_registry_id;
  if v_owner is not null and v_owner <> p_user_id then
    raise exception 'registry_already_claimed' using errcode = '23505';
  end if;

  update public.user_profiles
  set registry_id = p_registry_id,
      user_type = 'professional_manager',
      professional_manager_status = 'verified'
  where user_id = p_user_id;

  -- Dodele i recenzije koje su stanari vezali za red u registru sada pripadaju nalogu.
  update public.building_manager_assignments a
  set manager_user_id = p_user_id
  where a.registry_id = p_registry_id
    and a.manager_user_id is null
    and not exists (
      select 1 from public.building_manager_assignments x
      where x.building_id = a.building_id
        and x.manager_user_id = p_user_id
        and x.status in ('pending', 'active')
        and a.status in ('pending', 'active')
    );

  update public.manager_reviews r
  set manager_user_id = p_user_id
  where r.registry_id = p_registry_id
    and r.manager_user_id is null
    and not exists (
      select 1 from public.manager_reviews x
      where x.manager_user_id = p_user_id
        and x.reviewer_user_id = r.reviewer_user_id
        and x.building_id is not distinct from r.building_id
    );
end;
$$;

revoke all on function public.claim_registry_entry(uuid, bigint) from public, anon, authenticated;
grant execute on function public.claim_registry_entry(uuid, bigint) to service_role;

-- =============================================================================
-- 4. Zgrade: javno čitanje adresa, upis samo preko servera (Google validacija)
-- =============================================================================

alter table public.buildings
  add column if not exists google_place_id text,
  add column if not exists formatted_address text;

create unique index if not exists buildings_place_entrance_uidx
  on public.buildings (google_place_id, (public.normalize_text(coalesce(entrance, ''))))
  where google_place_id is not null;

create index if not exists buildings_addr_lookup_idx
  on public.buildings ((public.normalize_text(city)), street_normalized, (public.normalize_text(street_number)));

drop policy if exists "buildings: select for verified members or admin" on public.buildings;
drop policy if exists "buildings: select public" on public.buildings;
create policy "buildings: select public"
on public.buildings
for select
using (true);

drop policy if exists "buildings: insert authenticated" on public.buildings;

-- Pronađi ili napravi zgradu. Prva osoba na adresi "otvara" zgradu u bazi.
create or replace function public.find_or_create_building(
  p_google_place_id text,
  p_country text,
  p_city text,
  p_municipality text,
  p_street text,
  p_street_number text,
  p_entrance text,
  p_postal_code text,
  p_latitude double precision,
  p_longitude double precision,
  p_formatted_address text,
  p_created_by uuid
)
returns table (building_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrance text := nullif(btrim(coalesce(p_entrance, '')), '');
  v_id uuid;
begin
  if p_google_place_id is not null then
    select b.id into v_id
    from public.buildings b
    where b.google_place_id = p_google_place_id
      and public.normalize_text(coalesce(b.entrance, '')) = public.normalize_text(coalesce(v_entrance, ''))
    limit 1;
    if v_id is not null then
      return query select v_id, false;
      return;
    end if;
  end if;

  select b.id into v_id
  from public.buildings b
  where public.normalize_text(b.city) = public.normalize_text(p_city)
    and b.street_normalized = public.normalize_text(p_street)
    and public.normalize_text(b.street_number) = public.normalize_text(p_street_number)
    and public.normalize_text(coalesce(b.entrance, '')) = public.normalize_text(coalesce(v_entrance, ''))
  order by b.created_at
  limit 1;

  if v_id is not null then
    if p_google_place_id is not null then
      begin
        update public.buildings
        set google_place_id = p_google_place_id,
            formatted_address = coalesce(formatted_address, p_formatted_address),
            latitude = coalesce(latitude, p_latitude),
            longitude = coalesce(longitude, p_longitude)
        where id = v_id and google_place_id is null;
      exception when unique_violation then
        null;
      end;
    end if;
    return query select v_id, false;
    return;
  end if;

  begin
    insert into public.buildings (
      country, city, municipality, street, street_number, entrance, postal_code,
      latitude, longitude, google_place_id, formatted_address, created_by
    ) values (
      coalesce(nullif(btrim(p_country), ''), 'Srbija'), p_city, nullif(btrim(coalesce(p_municipality, '')), ''),
      p_street, p_street_number, v_entrance, nullif(btrim(coalesce(p_postal_code, '')), ''),
      p_latitude, p_longitude, p_google_place_id, p_formatted_address, p_created_by
    )
    returning id into v_id;
    return query select v_id, true;
  exception when unique_violation then
    -- Trka: neko je upravo napravio istu adresu.
    select b.id into v_id
    from public.buildings b
    where (p_google_place_id is not null and b.google_place_id = p_google_place_id
           and public.normalize_text(coalesce(b.entrance, '')) = public.normalize_text(coalesce(v_entrance, '')))
       or b.address_hash = public.building_address_hash(
            coalesce(nullif(btrim(p_country), ''), 'Srbija'), p_city, nullif(btrim(coalesce(p_municipality, '')), ''),
            p_street, p_street_number, v_entrance)
    limit 1;
    return query select v_id, false;
  end;
end;
$$;

revoke all on function public.find_or_create_building(text, text, text, text, text, text, text, text, double precision, double precision, text, uuid) from public, anon, authenticated;
grant execute on function public.find_or_create_building(text, text, text, text, text, text, text, text, double precision, double precision, text, uuid) to service_role;

-- =============================================================================
-- 5. Članstva: korisnik ne može sam sebe da verifikuje
-- =============================================================================

create or replace function public.protect_membership_columns()
returns trigger
language plpgsql
-- SECURITY INVOKER namerno: current_user mora biti uloga iz zahteva (anon/authenticated).
set search_path = public
as $$
begin
  if not public.is_end_user_request() or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'unverified';
    new.verification_method := null;
    if new.role not in ('resident', 'owner', 'tenant') then
      new.role := 'resident';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.building_id is distinct from old.building_id then
    raise exception 'protected_membership_column' using errcode = '42501';
  end if;

  -- Aktivni upravnik zgrade sme da verifikuje/odbije stanare svoje zgrade.
  if public.is_active_manager(old.building_id) and old.user_id <> auth.uid() then
    if new.role is distinct from old.role and new.role in ('manager', 'former_manager', 'board_member') then
      raise exception 'protected_membership_column' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
     or new.verification_method is distinct from old.verification_method
     or new.role is distinct from old.role
     or new.proof_document_path is distinct from old.proof_document_path then
    raise exception 'protected_membership_column' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_memberships_protect on public.building_memberships;
create trigger trg_memberships_protect
before insert or update on public.building_memberships
for each row execute function public.protect_membership_columns();

drop policy if exists "memberships: delete own" on public.building_memberships;
create policy "memberships: delete own"
on public.building_memberships
for delete
using (user_id = auth.uid() or public.is_admin());

-- =============================================================================
-- 6. Dodele upravnik–zgrada: samo "pending" od strane korisnika
-- =============================================================================

alter table public.building_manager_assignments
  drop constraint if exists building_manager_assignments_manager_ref_chk;
alter table public.building_manager_assignments
  add constraint building_manager_assignments_manager_ref_chk
  check (manager_user_id is not null or registry_id is not null);

alter table public.building_manager_assignments
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists source text not null default 'manager'
    check (source in ('manager', 'resident', 'admin', 'offer'));

create unique index if not exists bma_building_user_pending_active_uniq
  on public.building_manager_assignments (building_id, manager_user_id)
  where manager_user_id is not null and status in ('pending', 'active');

drop policy if exists "assignments: insert by verified professional manager" on public.building_manager_assignments;
create policy "assignments: insert by verified professional manager"
on public.building_manager_assignments
for insert
with check (
  manager_user_id = auth.uid()
  and status = 'pending'
  and approved_by is null
  and approved_at is null
  and exists (
    select 1 from public.user_profiles p
    where p.user_id = auth.uid()
      and p.user_type = 'professional_manager'
      and p.professional_manager_status = 'verified'
  )
);

-- Javno: ko trenutno upravlja zgradom (bez dokaza i internih polja) — potrebno na stranici zgrade.
drop policy if exists "assignments: select for members or admin" on public.building_manager_assignments;
create policy "assignments: select for members or admin"
on public.building_manager_assignments
for select
using (
  public.is_admin()
  or manager_user_id = auth.uid()
  or requested_by = auth.uid()
  or public.is_verified_member(building_id)
  or status in ('active', 'ended')
);

-- =============================================================================
-- 7. Recenzije: moderaciju ne može da zaobiđe autor
-- =============================================================================

create or replace function public.protect_review_status()
returns trigger
language plpgsql
-- SECURITY INVOKER namerno: current_user mora biti uloga iz zahteva (anon/authenticated).
set search_path = public
as $$
begin
  if not public.is_end_user_request() or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    return new;
  end if;

  if new.reviewer_user_id is distinct from old.reviewer_user_id
     or new.manager_user_id is distinct from old.manager_user_id
     or new.registry_id is distinct from old.registry_id
     or new.building_id is distinct from old.building_id then
    raise exception 'protected_review_column' using errcode = '42501';
  end if;

  -- Svaka izmena autora vraća recenziju na moderaciju.
  new.status := 'pending';
  return new;
end;
$$;

drop trigger if exists trg_reviews_protect on public.manager_reviews;
create trigger trg_reviews_protect
before insert or update on public.manager_reviews
for each row execute function public.protect_review_status();

create or replace function public.protect_reply_status()
returns trigger
language plpgsql
-- SECURITY INVOKER namerno: current_user mora biti uloga iz zahteva (anon/authenticated).
set search_path = public
as $$
begin
  if public.is_end_user_request() and not public.is_admin() then
    if tg_op = 'UPDATE' and old.status in ('hidden', 'removed') then
      new.status := old.status;
    elsif tg_op = 'INSERT' then
      new.status := 'published';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_replies_protect on public.review_replies;
create trigger trg_replies_protect
before insert or update on public.review_replies
for each row execute function public.protect_reply_status();

-- =============================================================================
-- 8. Dokumenta: javni/stanarski dokument može da doda samo aktivni upravnik
-- =============================================================================

drop policy if exists "documents: insert by uploader or manager/admin" on public.building_documents;
create policy "documents: insert by uploader or manager/admin"
on public.building_documents
for insert
with check (
  public.is_admin()
  or (
    uploaded_by = auth.uid()
    and (
      visibility = 'private'
      or (building_id is not null and public.is_active_manager(building_id))
    )
  )
);

-- =============================================================================
-- 9. Finansije: audit log preko triggera (ne može se falsifikovati iz klijenta)
-- =============================================================================

drop policy if exists "tx_audit: insert by authenticated" on public.transaction_audit_log;
drop policy if exists "tx_audit: select by admin" on public.transaction_audit_log;
create policy "tx_audit: select by admin/manager/residents"
on public.transaction_audit_log
for select
using (
  public.is_admin()
  or exists (
    select 1 from public.building_transactions t
    where t.id = transaction_id
      and (public.is_active_manager(t.building_id) or public.is_verified_member(t.building_id))
  )
);

create or replace function public.audit_building_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.created_by);
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    insert into public.transaction_audit_log (transaction_id, changed_by, action, old_data, new_data)
    values (new.id, v_actor, v_action, null, to_jsonb(new));
  else
    if new.building_id is distinct from old.building_id or new.created_by is distinct from old.created_by then
      raise exception 'protected_transaction_column' using errcode = '42501';
    end if;
    v_action := case
      when new.status = 'cancelled' and old.status <> 'cancelled' then 'cancelled'
      when new.document_id is distinct from old.document_id and old.document_id is null then 'document_added'
      else 'updated'
    end;
    insert into public.transaction_audit_log (transaction_id, changed_by, action, old_data, new_data)
    values (new.id, v_actor, v_action, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_transactions_audit on public.building_transactions;
create trigger trg_transactions_audit
after insert or update on public.building_transactions
for each row execute function public.audit_building_transaction();

-- =============================================================================
-- 10. Pretplate: upis samo preko servera; porudžbine (jedna uplata za više zgrada)
-- =============================================================================

drop policy if exists "bsub: insert by manager or admin" on public.building_subscriptions;

create table if not exists public.subscription_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 100001),
  payment_reference text not null unique,   -- poziv na broj (model 97, sa kontrolnim brojem)
  ordered_by uuid not null references auth.users(id),
  building_ids uuid[] not null check (cardinality(building_ids) between 1 and 200),
  months int not null check (months in (1, 6, 12)),
  amount_rsd int not null check (amount_rsd >= 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'cancelled')),
  paid_at timestamptz,
  activated_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sub_orders_status_idx on public.subscription_orders (status, created_at desc);
create index if not exists sub_orders_user_idx on public.subscription_orders (ordered_by);

alter table public.subscription_orders enable row level security;

drop policy if exists "sub_orders: select own or admin" on public.subscription_orders;
create policy "sub_orders: select own or admin"
on public.subscription_orders
for select
using (ordered_by = auth.uid() or public.is_admin());

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sub_orders_updated_at') then
    create trigger trg_sub_orders_updated_at
    before update on public.subscription_orders
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.building_subscriptions
  add column if not exists last_order_id uuid references public.subscription_orders(id),
  add column if not exists reminder_sent_at timestamptz;

-- Aktivan = status active I period nije istekao.
create or replace function public.is_building_premium(p_building uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.building_subscriptions s
    where s.building_id = p_building
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  )
$$;

grant execute on function public.is_building_premium(uuid) to anon, authenticated;

-- Admin potvrdi uplatu → sve zgrade iz porudžbine dobijaju (produžen) period.
create or replace function public.activate_subscription_order(p_order_id uuid, p_admin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.subscription_orders%rowtype;
  v_building uuid;
begin
  select * into v_order from public.subscription_orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'order_not_pending';
  end if;

  foreach v_building in array v_order.building_ids loop
    insert into public.building_subscriptions as s (
      building_id, subscribed_by, status, payment_reference, amount_rsd, activated_by,
      current_period_start, current_period_end, last_order_id
    ) values (
      v_building, v_order.ordered_by, 'active', v_order.payment_reference,
      (v_order.amount_rsd / cardinality(v_order.building_ids)), p_admin,
      now(), now() + make_interval(months => v_order.months), v_order.id
    )
    on conflict (building_id) do update set
      status = 'active',
      subscribed_by = excluded.subscribed_by,
      payment_reference = excluded.payment_reference,
      amount_rsd = excluded.amount_rsd,
      activated_by = excluded.activated_by,
      last_order_id = excluded.last_order_id,
      reminder_sent_at = null,
      current_period_start = case
        when s.status = 'active' and s.current_period_end > now() then s.current_period_start
        else now() end,
      current_period_end = case
        when s.status = 'active' and s.current_period_end > now()
          then s.current_period_end + make_interval(months => v_order.months)
        else now() + make_interval(months => v_order.months) end;
  end loop;

  update public.subscription_orders
  set status = 'paid', paid_at = now(), activated_by = p_admin
  where id = p_order_id;
end;
$$;

revoke all on function public.activate_subscription_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_subscription_order(uuid, uuid) to service_role;

-- payment_reference na building_subscriptions više nije jedinstven (jedna uplata → više zgrada).
alter table public.building_subscriptions drop constraint if exists building_subscriptions_payment_reference_key;

-- =============================================================================
-- 11. Ponude upravnika zgradama
-- =============================================================================

create table if not exists public.manager_offers (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  price_monthly_rsd int check (price_monthly_rsd is null or price_monthly_rsd between 0 and 10000000),
  contact_email text,
  contact_phone text,
  status text not null default 'sent' check (status in ('sent', 'withdrawn', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manager_offers_open_uidx
  on public.manager_offers (building_id, manager_user_id) where status = 'sent';
create index if not exists manager_offers_building_idx on public.manager_offers (building_id, created_at desc);
create index if not exists manager_offers_manager_idx on public.manager_offers (manager_user_id, created_at desc);

alter table public.manager_offers enable row level security;

drop policy if exists "offers: select" on public.manager_offers;
create policy "offers: select"
on public.manager_offers
for select
using (
  public.is_admin()
  or manager_user_id = auth.uid()
  or (
    status = 'sent'
    and exists (
      select 1 from public.building_memberships bm
      where bm.building_id = manager_offers.building_id and bm.user_id = auth.uid()
    )
  )
);

drop policy if exists "offers: insert by verified manager" on public.manager_offers;
create policy "offers: insert by verified manager"
on public.manager_offers
for insert
with check (
  manager_user_id = auth.uid()
  and status = 'sent'
  and exists (
    select 1 from public.user_profiles p
    where p.user_id = auth.uid()
      and p.user_type = 'professional_manager'
      and p.professional_manager_status = 'verified'
  )
);

drop policy if exists "offers: update own or admin" on public.manager_offers;
create policy "offers: update own or admin"
on public.manager_offers
for update
using (manager_user_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (manager_user_id = auth.uid() and status in ('sent', 'withdrawn'))
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_manager_offers_updated_at') then
    create trigger trg_manager_offers_updated_at
    before update on public.manager_offers
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Zgrade bez aktivnog upravnika (za upravnike koji traže nove zgrade).
create or replace function public.rpc_buildings_without_manager(
  p_city text,
  p_limit int,
  p_offset int
)
returns table (
  building_id uuid,
  city text,
  municipality text,
  street text,
  street_number text,
  entrance text,
  members_count int,
  open_offers_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id, b.city, b.municipality, b.street, b.street_number, b.entrance,
    (select count(*)::int from public.building_memberships bm where bm.building_id = b.id) as members_count,
    (select count(*)::int from public.manager_offers o where o.building_id = b.id and o.status = 'sent') as open_offers_count
  from public.buildings b
  where not exists (
      select 1 from public.building_manager_assignments a
      where a.building_id = b.id and a.status = 'active'
    )
    and (nullif(btrim(coalesce(p_city, '')), '') is null
         or public.normalize_text(b.city) like '%' || public.normalize_text(p_city) || '%'
         or public.normalize_text(coalesce(b.municipality, '')) like '%' || public.normalize_text(p_city) || '%')
  order by members_count desc, b.created_at desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(nullif(p_limit, 0), 50), 1), 100);
$$;

revoke all on function public.rpc_buildings_without_manager(text, int, int) from public;
grant execute on function public.rpc_buildings_without_manager(text, int, int) to authenticated;

-- =============================================================================
-- 12. Statistika upravnika: samo objavljene recenzije, bez umnožavanja redova
-- =============================================================================

create or replace view public.manager_stats as
with rev as (
  select
    r.manager_user_id,
    round(avg(r.rating_overall)::numeric, 2) as average_rating,
    count(*)::int as review_count,
    round(avg(r.rating_transparency)::numeric, 2) as transparency_rating,
    round(avg(r.rating_communication)::numeric, 2) as communication_rating,
    round(avg(r.rating_responsiveness)::numeric, 2) as responsiveness_rating,
    max(r.created_at) as last_review_at
  from public.manager_reviews r
  where r.manager_user_id is not null and r.status = 'published'
  group by r.manager_user_id
),
asg as (
  select
    a.manager_user_id,
    count(distinct a.building_id) filter (where a.status = 'active')::int as active_buildings_count,
    count(distinct a.building_id) filter (where a.status = 'ended')::int as historical_buildings_count,
    jsonb_agg(distinct b.municipality) filter (where b.municipality is not null and a.status in ('active', 'ended')) as municipalities
  from public.building_manager_assignments a
  join public.buildings b on b.id = a.building_id
  where a.manager_user_id is not null
  group by a.manager_user_id
)
select
  coalesce(rev.manager_user_id, asg.manager_user_id) as manager_user_id,
  rev.average_rating,
  coalesce(rev.review_count, 0) as review_count,
  rev.transparency_rating,
  rev.communication_rating,
  rev.responsiveness_rating,
  coalesce(asg.active_buildings_count, 0) as active_buildings_count,
  coalesce(asg.historical_buildings_count, 0) as historical_buildings_count,
  rev.last_review_at,
  asg.municipalities
from rev
full outer join asg on asg.manager_user_id = rev.manager_user_id;

-- Pretraga registra: veza preko user_profiles.registry_id; ocene i za neprezete redove.
create or replace function public.rpc_pretraga_registry(
  p_q text,
  p_municipality text,
  p_limit int,
  p_offset int,
  p_sort text
)
returns table (
  id bigint,
  full_name text,
  municipality text,
  license_number text,
  email text,
  phone text,
  source_url text,
  raw_data jsonb,
  platform_user_id uuid,
  average_rating numeric,
  review_count int,
  active_buildings_count int,
  historical_buildings_count int,
  last_review_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select r.id, r.full_name, r.municipality, r.license_number, r.email, r.phone, r.source_url, r.raw_data
    from public.professional_manager_registry r
    where r.is_active
      and (nullif(btrim(coalesce(p_municipality, '')), '') is null
        or r.municipality ilike '%' || btrim(p_municipality) || '%')
      and (
        nullif(btrim(coalesce(p_q, '')), '') is null
        or public.normalize_text(r.full_name) like '%' || public.normalize_text(p_q) || '%'
        or r.email::text ilike '%' || btrim(p_q) || '%'
        or r.license_number = btrim(p_q)
      )
  ),
  rev as (
    select
      b.id as registry_id,
      round(avg(mr.rating_overall)::numeric, 2) as average_rating,
      count(mr.id)::int as review_count,
      max(mr.created_at) as last_review_at
    from base b
    left join public.user_profiles up on up.registry_id = b.id
    join public.manager_reviews mr
      on mr.status = 'published'
     and (mr.registry_id = b.id or (up.user_id is not null and mr.manager_user_id = up.user_id))
    group by b.id
  ),
  asg as (
    select
      b.id as registry_id,
      count(distinct a.building_id) filter (where a.status = 'active')::int as active_buildings_count,
      count(distinct a.building_id) filter (where a.status = 'ended')::int as historical_buildings_count
    from base b
    left join public.user_profiles up on up.registry_id = b.id
    join public.building_manager_assignments a
      on a.registry_id = b.id or (up.user_id is not null and a.manager_user_id = up.user_id)
    group by b.id
  ),
  joined as (
    select
      b.id, b.full_name, b.municipality, b.license_number, b.email::text as email, b.phone,
      b.source_url, b.raw_data,
      up.user_id as platform_user_id,
      rev.average_rating,
      coalesce(rev.review_count, 0) as review_count,
      coalesce(asg.active_buildings_count, 0) as active_buildings_count,
      coalesce(asg.historical_buildings_count, 0) as historical_buildings_count,
      rev.last_review_at
    from base b
    left join public.user_profiles up on up.registry_id = b.id
    left join rev on rev.registry_id = b.id
    left join asg on asg.registry_id = b.id
  )
  select * from joined j
  order by
    case when p_sort = 'rating_desc' then j.average_rating end desc nulls last,
    case when p_sort = 'reviews_desc' then j.review_count end desc nulls last,
    case when p_sort = 'newest_review' then j.last_review_at end desc nulls last,
    j.full_name asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(nullif(p_limit, 0), 250), 1), 250);
$$;

create or replace function public.rpc_pretraga_registry_count(
  p_q text,
  p_municipality text
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.professional_manager_registry r
  where r.is_active
    and (nullif(btrim(coalesce(p_municipality, '')), '') is null
      or r.municipality ilike '%' || btrim(p_municipality) || '%')
    and (
      nullif(btrim(coalesce(p_q, '')), '') is null
      or public.normalize_text(r.full_name) like '%' || public.normalize_text(p_q) || '%'
      or r.email::text ilike '%' || btrim(p_q) || '%'
      or r.license_number = btrim(p_q)
    );
$$;

create or replace function public.rpc_registry_municipalities()
returns table (name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct btrim(r.municipality) as name
  from public.professional_manager_registry r
  where r.is_active and r.municipality is not null and btrim(r.municipality) <> ''
  order by 1
  limit 600;
$$;

-- Radius pretraga: i upravnici iz registra bez naloga se ne vide; platformski da.
-- (Postojeća search_managers_by_radius ostaje; manager_public_profiles daje imena.)
