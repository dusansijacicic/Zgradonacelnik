-- Javna pretraga: registar + ocene (preko verifikovanog naloga) + lista zgrada sa aktivnim upravnikom.
-- SECURITY DEFINER: čita tabele pod RLS koji inače blokiraju anon.

create or replace function public.rpc_pretraga_registry(
  p_q text,
  p_municipality text,
  p_limit int
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
  with reg as (
    select r.id, r.full_name, r.municipality, r.license_number, r.email, r.phone, r.source_url, r.raw_data
    from public.professional_manager_registry r
    where
      (nullif(btrim(coalesce(p_municipality, '')), '') is null
        or r.municipality ilike '%' || btrim(p_municipality) || '%')
      and (
        nullif(btrim(coalesce(p_q, '')), '') is null
        or r.full_name ilike '%' || btrim(p_q) || '%'
        or r.email::text ilike '%' || btrim(p_q) || '%'
      )
    order by r.full_name
    limit least(greatest(coalesce(nullif(p_limit, 0), 80), 1), 250)
  ),
  link as (
    select distinct on (m.registry_id)
      m.registry_id,
      m.user_id as platform_user_id
    from public.manager_verification_requests m
    where m.registry_id is not null
      and m.status = 'verified'::public.professional_manager_status
    order by m.registry_id, coalesce(m.reviewed_at, m.created_at) desc
  )
  select
    reg.id,
    reg.full_name,
    reg.municipality,
    reg.license_number,
    reg.email::text,
    reg.phone,
    reg.source_url,
    reg.raw_data,
    link.platform_user_id,
    ms.average_rating,
    coalesce(ms.review_count, 0) as review_count,
    coalesce(ms.active_buildings_count, 0) as active_buildings_count,
    coalesce(ms.historical_buildings_count, 0) as historical_buildings_count,
    ms.last_review_at
  from reg
  left join link on link.registry_id = reg.id
  left join public.manager_stats ms on ms.manager_user_id = link.platform_user_id;
$$;

revoke all on function public.rpc_pretraga_registry(text, text, int) from public;
grant execute on function public.rpc_pretraga_registry(text, text, int) to anon, authenticated;

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
      'Upravnik'
    ) as manager_display_name
  from public.building_manager_assignments a
  join public.buildings b on b.id = a.building_id
  left join public.user_profiles p on p.user_id = a.manager_user_id
  where a.status = 'active'::public.assignment_status
  order by b.city nulls last, b.municipality nulls last, b.street
  limit least(greatest(coalesce(nullif(p_limit, 0), 80), 1), 300);
$$;

revoke all on function public.rpc_public_active_manager_buildings(int) from public;
grant execute on function public.rpc_public_active_manager_buildings(int) to anon, authenticated;
