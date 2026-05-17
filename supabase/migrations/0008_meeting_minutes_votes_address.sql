-- Migration 0008: oauth_address kolone, zapisnici, glasanje, dokumenta za verifikaciju

-- ============================================================
-- 1. Kolone koje fale u user_profiles (oauth adresa)
-- ============================================================

alter table public.user_profiles
  add column if not exists oauth_address_line text,
  add column if not exists oauth_address_synced_at timestamptz;

-- ============================================================
-- 2. Zapisnici sa sastanaka (Premium funkcija)
-- ============================================================

create table if not exists public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  held_at timestamptz not null,
  location text,
  agenda text,
  decisions text,
  attendees_count int,
  document_id uuid references public.building_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_minutes_building_idx on public.meeting_minutes(building_id);
create index if not exists meeting_minutes_held_at_idx on public.meeting_minutes(held_at desc);

alter table public.meeting_minutes enable row level security;

create policy "minutes: select for residents/manager/admin"
on public.meeting_minutes
for select
using (
  public.is_admin()
  or public.is_verified_member(building_id)
  or public.is_active_manager(building_id)
);

create policy "minutes: insert/update by manager/admin"
on public.meeting_minutes
for all
using (public.is_admin() or public.is_active_manager(building_id))
with check (public.is_admin() or (created_by = auth.uid() and public.is_active_manager(building_id)));

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_minutes_updated_at') then
    create trigger trg_minutes_updated_at
    before update on public.meeting_minutes
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- ============================================================
-- 3. Glasanje stanara na predlozima
-- ============================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'proposal_vote_value') then
    create type public.proposal_vote_value as enum ('for', 'against', 'abstain');
  end if;
end $$;

create table if not exists public.proposal_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.building_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote public.proposal_vote_value not null,
  created_at timestamptz not null default now(),
  unique (proposal_id, user_id)
);

create index if not exists prop_votes_proposal_idx on public.proposal_votes(proposal_id);

alter table public.proposal_votes enable row level security;

create policy "pvotes: select for residents/admin"
on public.proposal_votes
for select
using (
  public.is_admin()
  or exists (
    select 1 from public.building_proposals p
    where p.id = proposal_id
    and (public.is_verified_member(p.building_id) or public.is_active_manager(p.building_id))
  )
);

create policy "pvotes: insert/update own vote as verified member"
on public.proposal_votes
for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.building_proposals p
    where p.id = proposal_id and public.is_verified_member(p.building_id)
  )
);

-- ============================================================
-- 4. Dokumenta za verifikaciju clanstva
-- ============================================================

alter table public.building_memberships
  add column if not exists proof_document_path text,
  add column if not exists proof_uploaded_at timestamptz,
  add column if not exists proof_note text;
