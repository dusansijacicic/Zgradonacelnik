-- Migration 0007: building-level premium subscriptions (manual payment) + onboarding flag

-- ============================================================
-- 1. Onboarding completion flag on user_profiles
-- ============================================================

alter table public.user_profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Backfill: existing users with a display_name are considered already onboarded
update public.user_profiles
set onboarding_completed = true
where display_name is not null and display_name <> '';

-- ============================================================
-- 2. Building-level premium subscriptions (manual payment flow)
-- ============================================================

create table if not exists public.building_subscriptions (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null unique references public.buildings(id) on delete cascade,
  subscribed_by uuid not null references auth.users(id),
  status text not null default 'inactive'
    check (status in ('active', 'pending_payment', 'expired', 'cancelled', 'inactive')),
  payment_reference text unique,   -- e.g. "ZGN-<short-id>" shown to user for bank transfer
  payment_method text not null default 'bank_transfer',
  amount_rsd integer not null default 500, -- promo price in RSD
  activated_by uuid references auth.users(id),  -- admin who confirmed the payment
  current_period_start timestamptz,
  current_period_end timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bsub_building_idx on public.building_subscriptions(building_id);
create index if not exists bsub_ref_idx on public.building_subscriptions(payment_reference);
create index if not exists bsub_status_idx on public.building_subscriptions(status);

alter table public.building_subscriptions enable row level security;

-- Members and active managers can see their building's subscription
create policy "bsub: select by member/manager/admin"
on public.building_subscriptions
for select
using (
  public.is_admin()
  or public.is_verified_member(building_id)
  or public.is_active_manager(building_id)
);

-- Only verified active manager of the building (or admin) can create a subscription request
create policy "bsub: insert by manager or admin"
on public.building_subscriptions
for insert
with check (
  public.is_admin()
  or (subscribed_by = auth.uid() and public.is_active_manager(building_id))
);

-- Only admin can update (activate/deactivate) — service role used for webhook-style updates
create policy "bsub: update by admin"
on public.building_subscriptions
for update
using (public.is_admin())
with check (public.is_admin());

-- updated_at trigger
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bsub_updated_at') then
    create trigger trg_bsub_updated_at
    before update on public.building_subscriptions
    for each row execute function public.set_updated_at();
  end if;
end $$;
