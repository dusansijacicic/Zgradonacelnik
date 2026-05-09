-- Paginacija + sortiranje za pretragu registra; lista opština za dropdown.

drop function if exists public.rpc_pretraga_registry(text, text, int);

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
  where
    (nullif(btrim(coalesce(p_municipality, '')), '') is null
      or r.municipality ilike '%' || btrim(p_municipality) || '%')
    and (
      nullif(btrim(coalesce(p_q, '')), '') is null
      or r.full_name ilike '%' || btrim(p_q) || '%'
      or r.email::text ilike '%' || btrim(p_q) || '%'
    );
$$;

revoke all on function public.rpc_pretraga_registry_count(text, text) from public;
grant execute on function public.rpc_pretraga_registry_count(text, text) to anon, authenticated;

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
  with link as (
    select distinct on (m.registry_id)
      m.registry_id,
      m.user_id as platform_user_id
    from public.manager_verification_requests m
    where m.registry_id is not null
      and m.status = 'verified'::public.professional_manager_status
    order by m.registry_id, coalesce(m.reviewed_at, m.created_at) desc
  ),
  base as (
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
  ),
  joined as (
    select
      b.id,
      b.full_name,
      b.municipality,
      b.license_number,
      b.email::text as email,
      b.phone,
      b.source_url,
      b.raw_data,
      l.platform_user_id,
      ms.average_rating,
      coalesce(ms.review_count, 0) as review_count,
      coalesce(ms.active_buildings_count, 0) as active_buildings_count,
      coalesce(ms.historical_buildings_count, 0) as historical_buildings_count,
      ms.last_review_at
    from base b
    left join link l on l.registry_id = b.id
    left join public.manager_stats ms on ms.manager_user_id = l.platform_user_id
  ),
  sorted as (
    select j.*
    from joined j
    order by
      case when nullif(btrim(coalesce(p_sort, '')), '') = 'rating_desc' then j.average_rating end desc nulls last,
      case when nullif(btrim(coalesce(p_sort, '')), '') = 'reviews_desc' then j.review_count end desc nulls last,
      case when nullif(btrim(coalesce(p_sort, '')), '') = 'newest_review' then j.last_review_at end desc nulls last,
      j.full_name asc
  )
  select * from sorted
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(nullif(p_limit, 0), 250), 1), 250);
$$;

revoke all on function public.rpc_pretraga_registry(text, text, int, int, text) from public;
grant execute on function public.rpc_pretraga_registry(text, text, int, int, text) to anon, authenticated;

create or replace function public.rpc_registry_municipalities()
returns table (name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct btrim(r.municipality) as name
  from public.professional_manager_registry r
  where r.municipality is not null and btrim(r.municipality) <> ''
  order by 1
  limit 600;
$$;

revoke all on function public.rpc_registry_municipalities() from public;
grant execute on function public.rpc_registry_municipalities() to anon, authenticated;
