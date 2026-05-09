-- Recenzije i dodele i kada upravnik nema nalog (vezivanje preko registra).

-- 1) Dodele: ili platformski korisnik ili red u registru
alter table public.building_manager_assignments
  add column if not exists registry_id bigint references public.professional_manager_registry (id) on delete cascade;

alter table public.building_manager_assignments
  alter column manager_user_id drop not null;

alter table public.building_manager_assignments
  drop constraint if exists building_manager_assignments_manager_ref_chk;

alter table public.building_manager_assignments
  add constraint building_manager_assignments_manager_ref_chk check (
    (manager_user_id is not null and registry_id is null)
    or (manager_user_id is null and registry_id is not null)
  );

create unique index if not exists bma_building_registry_pending_active_uniq
  on public.building_manager_assignments (building_id, registry_id)
  where registry_id is not null and status in ('pending', 'active');

-- 2) Recenzije: ili manager_user_id ili registry_id
alter table public.manager_reviews
  add column if not exists registry_id bigint references public.professional_manager_registry (id) on delete cascade;

alter table public.manager_reviews
  alter column manager_user_id drop not null;

alter table public.manager_reviews
  drop constraint if exists manager_reviews_manager_user_id_building_id_reviewer_user_id_key;

alter table public.manager_reviews
  drop constraint if exists manager_reviews_target_chk;

alter table public.manager_reviews
  add constraint manager_reviews_target_chk check (
    (manager_user_id is not null and registry_id is null)
    or (manager_user_id is null and registry_id is not null)
  );

create unique index if not exists manager_reviews_user_building_reviewer_uniq
  on public.manager_reviews (manager_user_id, building_id, reviewer_user_id)
  where manager_user_id is not null;

create unique index if not exists manager_reviews_registry_building_reviewer_uniq
  on public.manager_reviews (registry_id, building_id, reviewer_user_id)
  where registry_id is not null;

create index if not exists manager_reviews_registry_idx on public.manager_reviews (registry_id);

-- 3) RLS: recenzije — proširen join na dodele po registru; dozvoli pending dodelu
drop policy if exists "reviews: insert by eligible reviewer" on public.manager_reviews;

create policy "reviews: insert by eligible reviewer"
on public.manager_reviews
for insert
with check (
  manager_reviews.reviewer_user_id = auth.uid()
  and (
    manager_reviews.building_id is null
    or exists (
      select 1
      from public.building_memberships bm
      join public.building_manager_assignments a
        on a.building_id = bm.building_id
      where bm.user_id = auth.uid()
        and bm.building_id = manager_reviews.building_id
        and bm.verification_status = 'verified'
        and a.status in ('active', 'ended', 'pending')
        and (
          (
            manager_reviews.manager_user_id is not null
            and a.manager_user_id = manager_reviews.manager_user_id
          )
          or (
            manager_reviews.registry_id is not null
            and a.registry_id = manager_reviews.registry_id
          )
        )
    )
  )
);

-- 4) RLS: stanar predloži dodelu upravnika iz registra (pending)
drop policy if exists "assignments: insert pending registry by verified resident" on public.building_manager_assignments;

create policy "assignments: insert pending registry by verified resident"
on public.building_manager_assignments
for insert
with check (
  registry_id is not null
  and manager_user_id is null
  and status = 'pending'::public.assignment_status
  and auth.uid() is not null
  and public.is_verified_member(building_id)
);

-- 5) Statistika samo za naloge na platformi (bez registry-only redova)
create or replace view public.manager_stats as
select
  r.manager_user_id,
  round(avg(r.rating_overall)::numeric, 2) as average_rating,
  count(*)::int as review_count,
  round(avg(r.rating_transparency)::numeric, 2) as transparency_rating,
  round(avg(r.rating_communication)::numeric, 2) as communication_rating,
  round(avg(r.rating_responsiveness)::numeric, 2) as responsiveness_rating,
  count(distinct case when a.status = 'active' then a.building_id end)::int as active_buildings_count,
  count(distinct case when a.status = 'ended' then a.building_id end)::int as historical_buildings_count,
  max(r.created_at) as last_review_at,
  jsonb_agg(distinct b.municipality) filter (where b.municipality is not null) as municipalities
from public.manager_reviews r
left join public.buildings b on b.id = r.building_id
left join public.building_manager_assignments a
  on a.manager_user_id = r.manager_user_id
where r.manager_user_id is not null
group by r.manager_user_id;

-- 6) Javna lista zgrada: prikaži ime iz registra kada nema user_profiles
create or replace function public.rpc_public_active_manager_buildings(p_limit int)
returns table (
  building_id uuid,
  city text,
  municipality text,
  street text,
  street_number text,
  manager_user_id uuid,
  manager_display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.city,
    b.municipality,
    b.street,
    b.street_number,
    a.manager_user_id,
    coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
      nullif(btrim(reg.full_name), ''),
      'Upravnik'
    ) as manager_display_name
  from public.building_manager_assignments a
  join public.buildings b on b.id = a.building_id
  left join public.user_profiles p on p.user_id = a.manager_user_id
  left join public.professional_manager_registry reg on reg.id = a.registry_id
  where a.status = 'active'::public.assignment_status
  order by b.city nulls last, b.municipality nulls last, b.street
  limit least(greatest(coalesce(nullif(p_limit, 0), 80), 1), 300);
$$;

-- 7) Adresa sa Google naloga (opciono; JWT često nema ulicu — popunjava se kad postoji u metapodacima)
alter table public.user_profiles
  add column if not exists oauth_address_line text;

alter table public.user_profiles
  add column if not exists oauth_address_synced_at timestamptz;
