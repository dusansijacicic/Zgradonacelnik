-- Google identitet: telefon (anti-sybil) + sinhronizacija; jedan normalizovan broj = jedan nalog.

alter table public.user_profiles
  add column if not exists google_phone_raw text;

alter table public.user_profiles
  add column if not exists google_phone_normalized text;

alter table public.user_profiles
  add column if not exists google_identity_synced_at timestamptz;

comment on column public.user_profiles.google_phone_raw is 'Primarni broj iz Google People API (poslednja sinhronizacija pri OAuth).';
comment on column public.user_profiles.google_phone_normalized is 'normalize_phone(google_phone_raw); jedinstven među nalozima kad nije null.';
comment on column public.user_profiles.google_identity_synced_at is 'Poslednji uspešan poziv People API posle prijave.';

create unique index if not exists user_profiles_google_phone_normalized_uidx
  on public.user_profiles (google_phone_normalized)
  where google_phone_normalized is not null and btrim(google_phone_normalized) <> '';

create index if not exists user_profiles_google_phone_lookup_idx
  on public.user_profiles (google_phone_normalized)
  where google_phone_normalized is not null;
