-- Zgradonačelnik.rs — kompletna šema (init + RLS + triggeri + rate limit + geo RPC)
-- Jedan fajl: ranije 0001–0005. Pokreni u Supabase SQL editoru ili preko Supabase CLI migracija.

-- =============================================================================
-- EXTENSIONS I POMOĆNE FUNKCIJE (šema)
-- =============================================================================

create schema if not exists extensions;

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;
-- Supabase: objekti često u šemi `extensions`; nekvalifikovani unaccent() pada pri inline-u u generated kolone.
create extension if not exists unaccent with schema extensions;

-- Optional for radius search later (kept on from start).
create extension if not exists postgis;

-- Helpers
create or replace function public.normalize_text(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(input::text, ''))), '\s+', ' ', 'g')
$$;

create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(input,''), '[^0-9+]', '', 'g')
$$;

create or replace function public.building_address_hash(
  country text,
  city text,
  municipality text,
  street text,
  street_number text,
  entrance text
)
returns text
language sql
immutable
as $$
  select encode(
    digest(
      concat_ws('|',
        public.normalize_text(country),
        public.normalize_text(city),
        public.normalize_text(municipality),
        public.normalize_text(street),
        public.normalize_text(street_number),
        public.normalize_text(entrance)
      ),
      'sha256'
    ),
    'hex'
  )
$$;

-- User profile + roles
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_user_type') then
    create type public.app_user_type as enum ('resident', 'professional_manager', 'other');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'professional_manager_status') then
    create type public.professional_manager_status as enum ('not_requested','pending','verified','rejected','needs_manual_review','expired');
  end if;
end $$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  display_name text,
  phone text,
  municipality text,
  city text,
  user_type public.app_user_type not null default 'resident',
  is_admin boolean not null default false,
  professional_manager_status public.professional_manager_status not null default 'not_requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_user_type_idx on public.user_profiles(user_type);
create index if not exists user_profiles_prof_status_idx on public.user_profiles(professional_manager_status);

-- Registry import (MVP: manual CSV/JSON)
create table if not exists public.professional_manager_registry (
  id bigserial primary key,
  full_name text not null,
  first_name text,
  last_name text,
  license_number text,
  email text,
  phone text,
  municipality text,
  source_url text,
  imported_at timestamptz not null default now(),
  raw_data jsonb not null default '{}'::jsonb,
  normalized_email citext generated always as (nullif(public.normalize_text(email),'')) stored,
  normalized_phone text generated always as (nullif(public.normalize_phone(phone),'')) stored
);

create index if not exists pm_registry_email_idx on public.professional_manager_registry(normalized_email);
create index if not exists pm_registry_phone_idx on public.professional_manager_registry(normalized_phone);
create index if not exists pm_registry_name_trgm_idx on public.professional_manager_registry using gin (public.normalize_text(full_name) gin_trgm_ops);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'verification_method') then
    create type public.verification_method as enum ('email','phone','manual');
  end if;
end $$;

create table if not exists public.manager_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  registry_id bigint references public.professional_manager_registry(id),
  requested_email citext,
  requested_phone text,
  verification_method public.verification_method not null,
  status public.professional_manager_status not null default 'pending',
  otp_hash text,
  otp_expires_at timestamptz,
  attempts_count int not null default 0,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mvr_user_idx on public.manager_verification_requests(user_id);
create index if not exists mvr_status_idx on public.manager_verification_requests(status);

-- Buildings
do $$ begin
  if not exists (select 1 from pg_type where typname = 'building_status') then
    create type public.building_status as enum ('unverified','verified','disputed','archived');
  end if;
end $$;

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'Srbija',
  city text not null,
  municipality text,
  settlement text,
  street text not null,
  street_normalized text generated always as (public.normalize_text(street)) stored,
  street_number text not null,
  entrance text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  address_hash text generated always as (
    public.building_address_hash(country, city, municipality, street, street_number, entrance)
  ) stored,
  cadastral_info text,
  building_name text,
  status public.building_status not null default 'unverified',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (address_hash)
);

create index if not exists buildings_city_idx on public.buildings(city);
create index if not exists buildings_municipality_idx on public.buildings(municipality);
create index if not exists buildings_address_trgm_idx on public.buildings using gin (
  (public.normalize_text(city)) gin_trgm_ops,
  (public.normalize_text(municipality)) gin_trgm_ops,
  (public.normalize_text(street)) gin_trgm_ops
);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'membership_role') then
    create type public.membership_role as enum ('resident','owner','tenant','board_member','manager','former_manager');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'membership_verification_status') then
    create type public.membership_verification_status as enum ('unverified','pending','verified','rejected');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'membership_verification_method') then
    create type public.membership_verification_method as enum ('admin','document','invite_code','manager_invite','resident_confirmation');
  end if;
end $$;

create table if not exists public.building_memberships (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'resident',
  verification_status public.membership_verification_status not null default 'unverified',
  verification_method public.membership_verification_method,
  apartment_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, user_id, role)
);

create index if not exists building_memberships_building_idx on public.building_memberships(building_id);
create index if not exists building_memberships_user_idx on public.building_memberships(user_id);

-- Documents
do $$ begin
  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type public.document_type as enum ('invoice','receipt','contract','meeting_minutes','decision','bank_statement','photo','other');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'document_visibility') then
    create type public.document_visibility as enum ('residents_only','managers_only','public','private');
  end if;
end $$;

create table if not exists public.building_documents (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references public.buildings(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  document_type public.document_type not null default 'other',
  title text,
  description text,
  file_path text not null,
  file_name text,
  mime_type text,
  file_size bigint,
  visibility public.document_visibility not null default 'private',
  created_at timestamptz not null default now()
);

create index if not exists building_documents_building_idx on public.building_documents(building_id);

-- Manager assignments
do $$ begin
  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum ('pending','active','rejected','ended','disputed');
  end if;
end $$;

create table if not exists public.building_manager_assignments (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  status public.assignment_status not null default 'pending',
  start_date date,
  end_date date,
  proof_document_id uuid references public.building_documents(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bma_building_idx on public.building_manager_assignments(building_id);
create index if not exists bma_manager_idx on public.building_manager_assignments(manager_user_id);

-- Reviews
do $$ begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('pending','published','hidden','removed','disputed');
  end if;
end $$;

create table if not exists public.manager_reviews (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  rating_overall int not null check (rating_overall between 1 and 5),
  rating_transparency int check (rating_transparency between 1 and 5),
  rating_communication int check (rating_communication between 1 and 5),
  rating_responsiveness int check (rating_responsiveness between 1 and 5),
  rating_price_quality int check (rating_price_quality between 1 and 5),
  title text,
  content text,
  status public.review_status not null default 'pending',
  is_anonymous_publicly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manager_user_id, building_id, reviewer_user_id)
);

create index if not exists manager_reviews_manager_idx on public.manager_reviews(manager_user_id);
create index if not exists manager_reviews_building_idx on public.manager_reviews(building_id);
create index if not exists manager_reviews_status_idx on public.manager_reviews(status);

create table if not exists public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.manager_reviews(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  status public.review_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id)
);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.manager_reviews(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists review_reports_review_idx on public.review_reports(review_id);

-- Online building diary (financials) - prepared for MVP3
do $$ begin
  if not exists (select 1 from pg_type where typname = 'account_visibility') then
    create type public.account_visibility as enum ('private','residents_only','public_summary');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('inflow','outflow');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'transaction_visibility') then
    create type public.transaction_visibility as enum ('residents_only','public_summary','private');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    create type public.transaction_status as enum ('active','corrected','cancelled');
  end if;
end $$;

create table if not exists public.building_financial_accounts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  account_name text not null,
  bank_name text,
  account_number_masked text,
  current_balance numeric(14,2) not null default 0,
  balance_date date,
  visibility public.account_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bfa_building_idx on public.building_financial_accounts(building_id);

create table if not exists public.building_transactions (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.building_financial_accounts(id) on delete set null,
  transaction_type public.transaction_type not null,
  category text,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'RSD',
  transaction_date date not null,
  description text,
  counterparty_name text,
  counterparty_type text,
  document_id uuid references public.building_documents(id),
  visibility public.transaction_visibility not null default 'residents_only',
  status public.transaction_status not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bt_building_idx on public.building_transactions(building_id);
create index if not exists bt_manager_idx on public.building_transactions(manager_user_id);
create index if not exists bt_date_idx on public.building_transactions(transaction_date desc);

create table if not exists public.transaction_audit_log (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.building_transactions(id) on delete cascade,
  changed_by uuid not null references auth.users(id),
  action text not null check (action in ('created','updated','cancelled','document_added')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tal_tx_idx on public.transaction_audit_log(transaction_id);

-- Announcements and proposals
do $$ begin
  if not exists (select 1 from pg_type where typname = 'announcement_visibility') then
    create type public.announcement_visibility as enum ('residents_only','public');
  end if;
end $$;

create table if not exists public.building_announcements (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  content text not null,
  visibility public.announcement_visibility not null default 'residents_only',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ba_building_idx on public.building_announcements(building_id);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'proposal_category') then
    create type public.proposal_category as enum ('repair','cleaning','security','maintenance','finance','other');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'proposal_status') then
    create type public.proposal_status as enum ('proposed','under_review','accepted','rejected','completed');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'proposal_priority') then
    create type public.proposal_priority as enum ('low','medium','high','urgent');
  end if;
end $$;

create table if not exists public.building_proposals (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  description text not null,
  category public.proposal_category not null default 'other',
  status public.proposal_status not null default 'proposed',
  estimated_cost numeric(14,2),
  priority public.proposal_priority not null default 'low',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bp_building_idx on public.building_proposals(building_id);

create table if not exists public.proposal_comments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.building_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pc_proposal_idx on public.proposal_comments(proposal_id);

-- Subscriptions (architecture ready; payment provider later)
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_monthly numeric(14,2) not null,
  max_buildings int,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id),
  status text not null default 'active' check (status in ('active','trialing','past_due','cancelled','expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  payment_provider text,
  payment_provider_subscription_id text
);

create index if not exists user_subscriptions_user_idx on public.user_subscriptions(user_id);

-- Audit log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id text,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log(actor_user_id);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

-- =============================================================================
-- RLS (MVP baseline)
-- =============================================================================

-- Helper: is admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.user_profiles where user_id = auth.uid()), false)
$$;

-- Helper: membership check (verified resident/owner/tenant/board_member)
create or replace function public.is_verified_member(building uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.building_memberships bm
    where bm.building_id = building
      and bm.user_id = auth.uid()
      and bm.verification_status = 'verified'
      and bm.role in ('resident','owner','tenant','board_member','manager','former_manager')
  )
$$;

-- Helper: is manager of building (active assignment)
create or replace function public.is_active_manager(building uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.building_manager_assignments a
    where a.building_id = building
      and a.manager_user_id = auth.uid()
      and a.status = 'active'
  )
$$;

-- Enable RLS on all public tables we created
alter table public.user_profiles enable row level security;
alter table public.professional_manager_registry enable row level security;
alter table public.manager_verification_requests enable row level security;
alter table public.buildings enable row level security;
alter table public.building_memberships enable row level security;
alter table public.building_documents enable row level security;
alter table public.building_manager_assignments enable row level security;
alter table public.manager_reviews enable row level security;
alter table public.review_replies enable row level security;
alter table public.review_reports enable row level security;
alter table public.building_financial_accounts enable row level security;
alter table public.building_transactions enable row level security;
alter table public.transaction_audit_log enable row level security;
alter table public.building_announcements enable row level security;
alter table public.building_proposals enable row level security;
alter table public.proposal_comments enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.audit_log enable row level security;

-- user_profiles
create policy "profiles: select own or admin"
on public.user_profiles
for select
using (user_id = auth.uid() or public.is_admin());

create policy "profiles: insert self"
on public.user_profiles
for insert
with check (user_id = auth.uid());

create policy "profiles: update own or admin"
on public.user_profiles
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- professional_manager_registry
-- MVP compromise: allow authenticated SELECT by normalized email/phone for self-verification.
-- (Write stays admin-only.)
create policy "pm_registry: authenticated select"
on public.professional_manager_registry
for select
using (auth.uid() is not null);

create policy "pm_registry: admin insert"
on public.professional_manager_registry
for insert
with check (public.is_admin());

create policy "pm_registry: admin update"
on public.professional_manager_registry
for update
using (public.is_admin())
with check (public.is_admin());

-- manager_verification_requests
create policy "mvr: select own or admin"
on public.manager_verification_requests
for select
using (user_id = auth.uid() or public.is_admin());

create policy "mvr: insert own"
on public.manager_verification_requests
for insert
with check (user_id = auth.uid());

create policy "mvr: update own pending fields or admin"
on public.manager_verification_requests
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- buildings (MVP: authenticated can create; read for members/admin; public later)
create policy "buildings: select for verified members or admin"
on public.buildings
for select
using (public.is_verified_member(id) or public.is_admin());

create policy "buildings: insert authenticated"
on public.buildings
for insert
with check (auth.uid() is not null);

create policy "buildings: update by admin"
on public.buildings
for update
using (public.is_admin())
with check (public.is_admin());

-- building_memberships
create policy "memberships: select own or building manager/admin"
on public.building_memberships
for select
using (
  user_id = auth.uid()
  or public.is_admin()
  or public.is_active_manager(building_id)
);

create policy "memberships: insert self"
on public.building_memberships
for insert
with check (user_id = auth.uid());

create policy "memberships: update own unverified or manager/admin"
on public.building_memberships
for update
using (
  user_id = auth.uid()
  or public.is_admin()
  or public.is_active_manager(building_id)
)
with check (
  user_id = auth.uid()
  or public.is_admin()
  or public.is_active_manager(building_id)
);

-- building_documents (private by default)
create policy "documents: select for allowed audiences"
on public.building_documents
for select
using (
  public.is_admin()
  or uploaded_by = auth.uid()
  or (
    building_id is not null
    and (
      (visibility = 'public')
      or (visibility = 'residents_only' and public.is_verified_member(building_id))
      or (visibility = 'managers_only' and public.is_active_manager(building_id))
      or (visibility = 'private' and uploaded_by = auth.uid())
    )
  )
);

-- Allow uploader to create private docs even before assignment is active (needed for proof docs).
create policy "documents: insert by uploader or manager/admin"
on public.building_documents
for insert
with check (
  public.is_admin()
  or uploaded_by = auth.uid()
  or (building_id is not null and public.is_active_manager(building_id))
);

create policy "documents: update by uploader or admin"
on public.building_documents
for update
using (uploaded_by = auth.uid() or public.is_admin())
with check (uploaded_by = auth.uid() or public.is_admin());

-- building_manager_assignments (admin moderated MVP)
create policy "assignments: select for members or admin"
on public.building_manager_assignments
for select
using (public.is_admin() or public.is_verified_member(building_id) or manager_user_id = auth.uid());

create policy "assignments: insert by verified professional manager"
on public.building_manager_assignments
for insert
with check (
  auth.uid() is not null
  and manager_user_id = auth.uid()
  and exists (
    select 1 from public.user_profiles p
    where p.user_id = auth.uid()
      and p.user_type = 'professional_manager'
      and p.professional_manager_status = 'verified'
  )
);

create policy "assignments: update by admin"
on public.building_manager_assignments
for update
using (public.is_admin())
with check (public.is_admin());

-- manager_reviews (public read of published; write limited to eligible)
create policy "reviews: public select published"
on public.manager_reviews
for select
using (status = 'published' or reviewer_user_id = auth.uid() or public.is_admin() or manager_user_id = auth.uid());

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
       and a.manager_user_id = manager_reviews.manager_user_id
      where bm.user_id = auth.uid()
        and bm.building_id = manager_reviews.building_id
        and bm.verification_status = 'verified'
        and a.status in ('active','ended')
    )
  )
);

create policy "reviews: update by reviewer or admin"
on public.manager_reviews
for update
using (reviewer_user_id = auth.uid() or public.is_admin())
with check (reviewer_user_id = auth.uid() or public.is_admin());

-- review_replies (manager can reply, admin can moderate)
create policy "review_replies: select if review visible"
on public.review_replies
for select
using (
  public.is_admin()
  or exists (
    select 1 from public.manager_reviews r
    where r.id = review_id
      and (r.status = 'published' or r.reviewer_user_id = auth.uid() or r.manager_user_id = auth.uid() or public.is_admin())
  )
);

create policy "review_replies: insert by manager"
on public.review_replies
for insert
with check (
  manager_user_id = auth.uid()
  and exists (select 1 from public.manager_reviews r where r.id = review_id and r.manager_user_id = auth.uid())
);

create policy "review_replies: update by manager or admin"
on public.review_replies
for update
using (manager_user_id = auth.uid() or public.is_admin())
with check (manager_user_id = auth.uid() or public.is_admin());

-- review_reports
create policy "review_reports: select own or admin"
on public.review_reports
for select
using (reported_by = auth.uid() or public.is_admin());

create policy "review_reports: insert by authenticated"
on public.review_reports
for insert
with check (reported_by = auth.uid());

create policy "review_reports: update by admin"
on public.review_reports
for update
using (public.is_admin())
with check (public.is_admin());

-- Financial accounts/transactions/audit logs: managers + verified residents + admin
create policy "accounts: select for manager/residents/admin"
on public.building_financial_accounts
for select
using (public.is_admin() or public.is_active_manager(building_id) or public.is_verified_member(building_id));

create policy "accounts: insert/update by manager or admin"
on public.building_financial_accounts
for all
using (public.is_admin() or public.is_active_manager(building_id))
with check (public.is_admin() or public.is_active_manager(building_id));

create policy "transactions: select for manager/residents/admin"
on public.building_transactions
for select
using (public.is_admin() or public.is_active_manager(building_id) or public.is_verified_member(building_id));

create policy "transactions: insert by manager or admin"
on public.building_transactions
for insert
with check (public.is_admin() or (manager_user_id = auth.uid() and public.is_active_manager(building_id)));

create policy "transactions: update by manager or admin"
on public.building_transactions
for update
using (public.is_admin() or (manager_user_id = auth.uid() and public.is_active_manager(building_id)))
with check (public.is_admin() or (manager_user_id = auth.uid() and public.is_active_manager(building_id)));

create policy "tx_audit: select by admin"
on public.transaction_audit_log
for select
using (public.is_admin());

create policy "tx_audit: insert by authenticated"
on public.transaction_audit_log
for insert
with check (changed_by = auth.uid());

-- Announcements
create policy "announcements: select for residents/admin (public if public)"
on public.building_announcements
for select
using (public.is_admin() or visibility = 'public' or public.is_verified_member(building_id));

create policy "announcements: insert/update by manager/admin"
on public.building_announcements
for all
using (public.is_admin() or public.is_active_manager(building_id))
with check (public.is_admin() or public.is_active_manager(building_id));

-- Proposals & comments
create policy "proposals: select for residents/admin"
on public.building_proposals
for select
using (public.is_admin() or public.is_verified_member(building_id));

create policy "proposals: insert by verified member"
on public.building_proposals
for insert
with check (created_by = auth.uid() and public.is_verified_member(building_id));

create policy "proposals: update by manager/admin"
on public.building_proposals
for update
using (public.is_admin() or public.is_active_manager(building_id))
with check (public.is_admin() or public.is_active_manager(building_id));

create policy "proposal_comments: select for residents/admin"
on public.proposal_comments
for select
using (
  public.is_admin()
  or exists (select 1 from public.building_proposals p where p.id = proposal_id and public.is_verified_member(p.building_id))
);

create policy "proposal_comments: insert by verified member"
on public.proposal_comments
for insert
with check (
  user_id = auth.uid()
  and exists (select 1 from public.building_proposals p where p.id = proposal_id and public.is_verified_member(p.building_id))
);

-- Subscriptions: plans readable for all authenticated; user_subscriptions only own/admin
create policy "plans: select for authenticated"
on public.subscription_plans
for select
using (auth.uid() is not null or public.is_admin());

create policy "plans: admin write"
on public.subscription_plans
for all
using (public.is_admin())
with check (public.is_admin());

create policy "user_subs: select own/admin"
on public.user_subscriptions
for select
using (user_id = auth.uid() or public.is_admin());

create policy "user_subs: insert/update admin"
on public.user_subscriptions
for all
using (public.is_admin())
with check (public.is_admin());

-- audit_log: admin read; insert by authenticated (via RPC or service)
create policy "audit: admin select"
on public.audit_log
for select
using (public.is_admin());

create policy "audit: insert by authenticated"
on public.audit_log
for insert
with check (actor_user_id = auth.uid());

-- =============================================================================
-- updated_at triggeri + manager_stats view
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_user_profiles_updated_at') then
    create trigger trg_user_profiles_updated_at
    before update on public.user_profiles
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_mvr_updated_at') then
    create trigger trg_mvr_updated_at
    before update on public.manager_verification_requests
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_buildings_updated_at') then
    create trigger trg_buildings_updated_at
    before update on public.buildings
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_building_memberships_updated_at') then
    create trigger trg_building_memberships_updated_at
    before update on public.building_memberships
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bma_updated_at') then
    create trigger trg_bma_updated_at
    before update on public.building_manager_assignments
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_reviews_updated_at') then
    create trigger trg_reviews_updated_at
    before update on public.manager_reviews
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_review_replies_updated_at') then
    create trigger trg_review_replies_updated_at
    before update on public.review_replies
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_accounts_updated_at') then
    create trigger trg_accounts_updated_at
    before update on public.building_financial_accounts
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_transactions_updated_at') then
    create trigger trg_transactions_updated_at
    before update on public.building_transactions
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_announcements_updated_at') then
    create trigger trg_announcements_updated_at
    before update on public.building_announcements
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_proposals_updated_at') then
    create trigger trg_proposals_updated_at
    before update on public.building_proposals
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_proposal_comments_updated_at') then
    create trigger trg_proposal_comments_updated_at
    before update on public.proposal_comments
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Manager stats as a VIEW (can be materialized later)
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
group by r.manager_user_id;

-- =============================================================================
-- Rate limit (audit_log)
-- =============================================================================

create or replace function public.rate_limit_check(
  p_action text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return false;
  end if;

  select count(*) into v_count
  from public.audit_log
  where actor_user_id = auth.uid()
    and action = p_action
    and created_at > now() - make_interval(secs => p_window_seconds);

  return v_count < p_limit;
end;
$$;

-- =============================================================================
-- Radius search (PostGIS; extension gore)
-- =============================================================================

create or replace function public.search_managers_by_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer
)
returns table (
  manager_user_id uuid,
  building_id uuid,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.manager_user_id,
    b.id as building_id,
    st_distance(
      st_setsrid(st_makepoint(b.longitude, b.latitude), 4326)::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) as distance_meters
  from public.building_manager_assignments a
  join public.buildings b on b.id = a.building_id
  where a.status = 'active'
    and b.latitude is not null
    and b.longitude is not null
    and st_dwithin(
      st_setsrid(st_makepoint(b.longitude, b.latitude), 4326)::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  order by distance_meters asc
  limit 200;
$$;
