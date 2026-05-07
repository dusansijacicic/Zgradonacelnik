# Zgradonačelnik.rs (MVP)

Platforma za transparentno upravljanje stambenim zajednicama, evidenciju profesionalnih upravnika, recenzije upravnika i online dnevnik zgrade.

## Stack

- **Frontend**: Next.js (App Router) + Tailwind
- **Backend/DB/Auth/Storage**: Supabase (PostgreSQL + RLS + Auth)
- **Hosting**: Vercel
- **Email OTP**: Resend (za verifikaciju profesionalnog upravnika)
 
## Klik‑po‑klik setup (HTML)

Otvorite `docs/setup.html` za kompletno uputstvo (Supabase, Vercel, Google OAuth, Resend, Storage, Turnstile, Mapbox).

## 1) Lokalno pokretanje

Instalacija:

```bash
npm i
```

Kreiraj `.env.local` po uzoru na `.env.example` i popuni:

- `NEXT_PUBLIC_SITE_URL` (npr. `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `MAPBOX_ACCESS_TOKEN` (opciono, za automatsko geokodiranje zgrada)

Pokretanje:

```bash
npm run dev
```

## 2) Supabase podešavanje (projekat + auth + DB)

### Kreiraj Supabase projekat

1. Napravi novi projekat u Supabase.
2. U **Project Settings → API** uzmi:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Uključi Google login

1. U Supabase: **Authentication → Providers → Google** → Enable.
2. U Google Cloud Console:
   - napravi OAuth Client (Web)
   - dodaj Authorized redirect URI:
     - `https://<tvoj-domain>/auth/callback`
     - za lokalno: `http://localhost:3000/auth/callback`
3. Client ID/Secret unesi u Supabase Google provider.

### Postavi DB šemu + RLS

U Supabase SQL editoru izvrši migracije redom:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_triggers_and_stats.sql`
4. `supabase/migrations/0004_rate_limit.sql`
5. `supabase/migrations/0005_geo_radius_rpc.sql`

## 3) Kako radi aplikacija (MVP tokovi)

### Login

- Stranica: `/login`
- Nakon Google logina: `/auth/callback` automatski pravi red u `user_profiles` (onboarding osnovni podaci se nadograđuju kasnije).

### Verifikacija profesionalnog upravnika (email OTP)

- Stranica: `/manager/verifikacija`
- API:
  - `POST /api/manager-verification/request` → kreira `manager_verification_requests`, šalje OTP na email
  - `POST /api/manager-verification/verify-otp` → proverava OTP i postavlja status na `verified`

### Admin panel

- `/admin` (traži `user_profiles.is_admin = true`)
- `/admin/registar-upravnika` → ručni CSV import registra
- `/admin/verifikacije` → odobravanje/odbijanje verifikacija
- `/admin/recenzije` → moderacija recenzija (publish/hide/remove)
- `/admin/zgrade-upravnici` → odobravanje veza upravnik–zgrada
- `/admin/prijave-recenzija` → prijave recenzija
- `/admin/audit-log` → audit zapisi
- `/admin/pretplate` → planovi (stub)

### Zgrade (MVP)

- `/dashboard/moje-zgrade` → lista tvojih članstava
- `/dashboard/moje-zgrade/nova` → kreiranje zgrade (anti-duplikat preko `address_hash`)
- `/zgrade/[id]` → dashboard zgrade
- `/zgrade/[id]/oglasna-tabla` → objave
- `/zgrade/[id]/predlozi` → predlozi radova
- `/zgrade/[id]/finansije` → transakcije (MVP)

API:
- `POST /api/buildings/create`
- `POST /api/announcements/create`
- `POST /api/proposals/create`
- `POST /api/proposal-comments/create`
- `POST /api/transactions/create`
- `POST /api/documents/upload`

### Upravnik ↔ zgrada (MVP)

- Upravnik vidi svoje veze: `/manager/zgrade`
- Upravnik može poslati zahtev direktno sa `/zgrade/[id]` (upload dokaza + request)
- API:
  - `POST /api/assignments/request` (upravnik šalje zahtev + `proof_document_id`)
  - `POST /api/admin/assignments` (admin approve/reject/end)

### Upload dokumenata (Supabase Storage)

API:
- `POST /api/documents/upload` (multipart/form-data)
- `GET /api/documents/signed-url?id=<document_uuid>` (signed URL, 10 min)

Env:
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `SUPABASE_STORAGE_BUCKET` (npr. `zgradonacelnik-private`)

## 9) CAPTCHA (Cloudflare Turnstile)

Ako želiš CAPTCHA zaštitu (preporučeno za OTP, recenzije, objave, predloge, komentare):

- U Cloudflare Turnstile napravi site i uzmi ključeve
- Dodaj u env:
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - `TURNSTILE_SECRET_KEY`

Ako `TURNSTILE_SECRET_KEY` nije setovan, CAPTCHA je automatski isključena (MVP).

## 10) Radius pretraga (PostGIS RPC)

U bazi postoji RPC funkcija:

- `public.search_managers_by_radius(lat, lng, radius_meters)`

Vraća aktivne upravnike preko aktivnih zgrada u radijusu. Da bi radilo, zgrade moraju imati `latitude/longitude`
i moraš imati aktivne `building_manager_assignments`.

## 11) Geokodiranje adrese (Mapbox)

Kada kreiraš zgradu kroz `/dashboard/moje-zgrade/nova`, backend pokušava “best-effort” geokodiranje adrese i upis
`latitude/longitude` u tabelu `buildings` (ako je `MAPBOX_ACCESS_TOKEN` setovan).

Napomena:
- Ako token nije setovan ili Mapbox ne nađe rezultat, zgrada se i dalje kreira normalno, samo bez koordinata.
- Radius pretraga na `/pretraga/mapa` ima smisla tek kad zgrade imaju koordinate i postoji bar jedan aktivan upravnik-zgrada assignment.

### Recenzije (reply + report)

API:
- `POST /api/review-replies/upsert`
- `POST /api/review-reports/create`

## 4) Kako da postaneš admin

MVP: ručno u bazi postavi admin flag.

U Supabase SQL editoru:

```sql
update public.user_profiles
set is_admin = true
where user_id = '<SUPABASE_AUTH_USER_UUID>';
```

## 5) Import registra profesionalnih upravnika (CSV)

Idi na `/admin/registar-upravnika` i nalepi CSV sa header-ima.

Primer CSV:

```csv
full_name,email,phone,license_number,municipality,source_url
Petar Petrović,petar@example.com,+38164111222,123-ABC,Voždovac,https://usluge.pks.rs/portal/registar-upravnika-zgrada
```

## 6) Email servis (Resend)

1. Otvori nalog na Resend i uzmi API key.
2. Dodaj u `.env.local`:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` (mora biti verifikovan sender/domain u Resend-u)

## 7) Deploy na Vercel

1. Poveži repo na Vercel.
2. Dodaj env varijable (kao u `.env.local`).
3. Setuj `NEXT_PUBLIC_SITE_URL` na produkcioni URL (npr. `https://zgradonacelnik-rs.vercel.app`).

## 8) Šta je sledeće (iz specifikacije)

Ostalo za dovršavanje (u sledećim iteracijama):

- kompletan onboarding profila (ime/prezime/telefon/opština + tip korisnika)
- potpuna logika zgrada (kreiranje + verifikacija stanara + assignment upravnika + dokaz dokument)
- napredna pretraga (filteri/sort + trigram/fts + mapa/radius)
- online dnevnik zgrade (finansije, dokumenti, audit trail UI)
- rate limiting + captcha na osetljive forme

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
