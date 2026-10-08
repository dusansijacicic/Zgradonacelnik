-- Migration 0012: brza pretraga registra + indeksi + blog.
-- Pokreni posle 0011.

-- =============================================================================
-- 1. Pretraga registra: jedan poziv, bez OR-spajanja, ukupan broj u istom upitu
-- =============================================================================
-- Stara verzija (0010) je spajala recenzije uslovom "registry_id = x OR manager_user_id = y",
-- što sprečava hash join; na praznom upitu (ceo registar) trajala je ~3 s.
-- Sada se statistika računa grupisanjem malih tabela, pa se spaja jednakostima.

create index if not exists manager_reviews_pub_registry_idx
  on public.manager_reviews (registry_id) where status = 'published' and registry_id is not null;
create index if not exists manager_reviews_pub_user_idx
  on public.manager_reviews (manager_user_id) where status = 'published' and manager_user_id is not null;
create index if not exists bma_registry_status_idx
  on public.building_manager_assignments (registry_id, status) where registry_id is not null;
create index if not exists bma_user_status_idx
  on public.building_manager_assignments (manager_user_id, status) where manager_user_id is not null;
create index if not exists pm_registry_active_name_idx
  on public.professional_manager_registry (full_name) where is_active;
create index if not exists pm_registry_municipality_idx
  on public.professional_manager_registry (municipality) where is_active;

drop function if exists public.rpc_pretraga_registry(text, text, int, int, text);

create function public.rpc_pretraga_registry(
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
  last_review_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select r.id, r.full_name, r.municipality, r.license_number, r.email, r.phone, r.source_url
    from public.professional_manager_registry r
    where r.is_active
      and (coalesce(btrim(p_municipality), '') = '' or r.municipality ilike '%' || btrim(p_municipality) || '%')
      and (
        coalesce(btrim(p_q), '') = ''
        or public.normalize_text(r.full_name) like '%' || public.normalize_text(p_q) || '%'
        or r.email::text ilike '%' || btrim(p_q) || '%'
        or r.license_number = btrim(p_q)
      )
  ),
  owners as (
    select up.registry_id, up.user_id from public.user_profiles up where up.registry_id is not null
  ),
  rev_reg as (
    select registry_id as rid, sum(rating_overall) as s, count(*) as c, max(created_at) as last_at
    from public.manager_reviews
    where status = 'published' and registry_id is not null
    group by registry_id
  ),
  rev_usr as (
    select manager_user_id as uid, sum(rating_overall) as s, count(*) as c, max(created_at) as last_at
    from public.manager_reviews
    where status = 'published' and manager_user_id is not null
    group by manager_user_id
  ),
  asg_reg as (
    select registry_id as rid,
      count(distinct building_id) filter (where status = 'active') as act,
      count(distinct building_id) filter (where status = 'ended') as hist
    from public.building_manager_assignments
    where registry_id is not null and status in ('active', 'ended')
    group by registry_id
  ),
  asg_usr as (
    select manager_user_id as uid,
      count(distinct building_id) filter (where status = 'active') as act,
      count(distinct building_id) filter (where status = 'ended') as hist
    from public.building_manager_assignments
    where manager_user_id is not null and status in ('active', 'ended')
    group by manager_user_id
  ),
  joined as (
    select
      b.id, b.full_name, b.municipality, b.license_number, b.email::text as email, b.phone, b.source_url,
      o.user_id as platform_user_id,
      (coalesce(rr.c, 0) + coalesce(ru.c, 0))::int as review_count,
      case when coalesce(rr.c, 0) + coalesce(ru.c, 0) > 0
        then round((coalesce(rr.s, 0) + coalesce(ru.s, 0))::numeric / (coalesce(rr.c, 0) + coalesce(ru.c, 0)), 2)
      end as average_rating,
      greatest(rr.last_at, ru.last_at) as last_review_at,
      greatest(coalesce(ar.act, 0), coalesce(au.act, 0))::int as active_buildings_count,
      greatest(coalesce(ar.hist, 0), coalesce(au.hist, 0))::int as historical_buildings_count
    from base b
    left join owners o on o.registry_id = b.id
    left join rev_reg rr on rr.rid = b.id
    left join rev_usr ru on ru.uid = o.user_id
    left join asg_reg ar on ar.rid = b.id
    left join asg_usr au on au.uid = o.user_id
  )
  select
    j.id, j.full_name, j.municipality, j.license_number, j.email, j.phone, j.source_url,
    jsonb_build_object('Status', 'Registrovan') as raw_data, -- pretraga prikazuje samo aktivne
    j.platform_user_id, j.average_rating, j.review_count,
    j.active_buildings_count, j.historical_buildings_count, j.last_review_at,
    count(*) over () as total_count
  from joined j
  order by
    case when p_sort = 'rating_desc' then j.average_rating end desc nulls last,
    case when p_sort = 'reviews_desc' then j.review_count end desc nulls last,
    case when p_sort = 'newest_review' then j.last_review_at end desc nulls last,
    j.full_name asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(nullif(p_limit, 0), 50), 1), 250);
$$;

revoke all on function public.rpc_pretraga_registry(text, text, int, int, text) from public;
grant execute on function public.rpc_pretraga_registry(text, text, int, int, text) to anon, authenticated;

-- Mesta sa brojem aktivnih upravnika (za stranice "Upravnici zgrada — <mesto>").
create or replace function public.rpc_registry_places()
returns table (name text, managers_count int)
language sql
stable
security definer
set search_path = public
as $$
  select btrim(r.municipality) as name, count(*)::int as managers_count
  from public.professional_manager_registry r
  where r.is_active and r.municipality is not null and btrim(r.municipality) <> ''
  group by btrim(r.municipality)
  order by 1;
$$;

revoke all on function public.rpc_registry_places() from public;
grant execute on function public.rpc_registry_places() to anon, authenticated;

-- =============================================================================
-- 2. Blog
-- =============================================================================

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 5 and 160),
  excerpt text not null default '' check (char_length(excerpt) <= 400),
  content_md text not null default '',
  cover_image_url text,
  tags text[] not null default '{}',
  seo_title text,
  seo_description text,
  author_name text not null default 'Zgradonačelnik.rs',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_published_idx on public.blog_posts (published_at desc) where status = 'published';

alter table public.blog_posts enable row level security;

drop policy if exists "blog: public read published" on public.blog_posts;
create policy "blog: public read published"
on public.blog_posts
for select
using (status = 'published' or public.is_admin());

drop policy if exists "blog: admin write" on public.blog_posts;
create policy "blog: admin write"
on public.blog_posts
for all
using (public.is_admin())
with check (public.is_admin());

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_blog_posts_updated_at') then
    create trigger trg_blog_posts_updated_at
    before update on public.blog_posts
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Tri NACRTA (status draft) — pregledaj i objavi iz Admin → Blog.
insert into public.blog_posts (slug, title, excerpt, tags, content_md) values
(
  'kako-proveriti-licencu-upravnika-zgrade',
  'Kako da proverite da li vaš upravnik zgrade ima licencu',
  'Profesionalni upravnik mora biti upisan u registar Privredne komore Srbije. Evo kako da za par minuta proverite svog upravnika.',
  array['upravnik', 'licenca', 'registar'],
  $md$Profesionalni upravnik stambene zajednice mora imati licencu i biti upisan u registar koji vodi Privredna komora Srbije (PKS). Ako upravnik nije u registru, ili je iz njega obrisan, to je ozbiljan znak za uzbunu.

## Gde se nalazi registar

Javni registar profesionalnih upravnika objavljuje PKS na svom portalu. Na Zgradonačelnik.rs isti podaci su dostupni u [pretrazi upravnika](/pretraga), sa ocenama stanara i zgradama kojima upravnik upravlja.

## Kako da proverite upravnika

1. Otvorite [pretragu upravnika](/pretraga).
2. Upišite ime i prezime upravnika ili broj licence.
3. Proverite da li se upravnik pojavljuje i u kom mestu je registrovan.

Ako upravnika ne nađete, pitajte ga za broj licence i proverite ponovo. Upravnici čija je licenca oduzeta ne prikazuju se kao aktivni.

## Šta još da proverite

- Da li postoji ugovor između stambene zajednice i upravnika.
- Da li je upravnik postavljen odlukom skupštine stambene zajednice.
- Kako i koliko često izveštava o finansijama zgrade.

## Ocene drugih stanara

Na profilu upravnika vidite ocene stanara iz zgrada kojima upravlja: transparentnost, komunikaciju, ažurnost i odnos cene i kvaliteta. Ako ste stanar zgrade, i vi možete ostaviti ocenu kada potvrdite da stanujete u njoj.$md$
),
(
  'transparentne-finansije-zgrade',
  'Transparentne finansije zgrade: šta stanari treba da vide',
  'Mesečni doprinos plaćate redovno, ali da li znate na šta se troši? Pregled onoga što bi svaki stanar trebalo da ima na uvid.',
  array['finansije', 'stanari', 'transparentnost'],
  $md$Stanari svake zgrade izdvajaju novac za tekuće održavanje, a često i za investiciono održavanje i hitne popravke. Transparentno upravljanje znači da svaki stanar može da vidi koliko je novca uplaćeno, koliko je potrošeno i na šta.

## Osnovno što treba da bude vidljivo

- **Stanje računa** stambene zajednice i datum stanja.
- **Prilivi**: uplate stanara, zakup zajedničkih prostorija, ostali prihodi.
- **Odlivi**: računi za struju i vodu zajedničkih prostorija, čišćenje, lift, popravke, naknada upravniku.
- **Dokazi** uz svaki veći trošak: račun, ugovor ili ponuda.

## Zašto je audit trag važan

Finansijska stavka ne bi smela da se briše bez traga. Ako se iznos ispravi, treba da ostane zapis ko je i kada promenio podatak. Na Zgradonačelnik.rs svaka izmena finansijske stavke automatski ostaje zabeležena.

## Kako da počnete

1. [Registrujte se](/login) i dodajte svoju zgradu.
2. Pozovite komšije i potvrdite stanovanje.
3. Povežite upravnika zgrade sa platformom.

Kada upravnik aktivira Premium za zgradu, svi potvrđeni stanari vide finansije, zapisnike sa skupština i predloge radova.$md$
),
(
  'kako-dodati-zgradu-na-zgradonacelnik',
  'Kako da dodate svoju zgradu na Zgradonačelnik.rs',
  'Korak po korak: registracija, adresa zgrade, potvrda stanovanja i povezivanje upravnika.',
  array['vodič', 'stanari'],
  $md$Dodavanje zgrade traje par minuta. Svaka adresa na platformi postoji samo jednom, pa ako je neko iz vaše zgrade već stigao pre vas, samo ćete se pridružiti.

## 1. Prijava

Prijavite se [Google nalogom ili email adresom](/login). Lozinka nije potrebna.

## 2. Osnovni podaci i adresa

Unesite ime, prezime, godinu rođenja i adresu stanovanja. Adresu birate iz predloga dok kucate, a ako zgrada ima više ulaza, upišite i ulaz.

## 3. Potvrda stanovanja

Na stranici zgrade pošaljite dokaz da stanujete u njoj: ugovor, list nepokretnosti ili račun na vaše ime za tu adresu. Lične podatke koji nisu potrebni možete zatamniti. Dokaz vidi samo upravnik zgrade i administrator.

## 4. Povežite upravnika

Ako znate ko je upravnik vaše zgrade, pronađite ga po imenu u registru direktno sa stranice zgrade. Ako zgrada nema upravnika, licencirani upravnici mogu da vam pošalju ponudu.

## Šta dobijate

Potvrđeni stanari ocenjuju upravnika i prate oglasnu tablu. Kada zgrada ima Premium, dostupni su i finansije, zapisnici i predlozi radova sa glasanjem.$md$
)
on conflict (slug) do nothing;
