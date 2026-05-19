# Zgradonačelnik.rs — Setup uputstvo

## 1. Vercel — Environment varijable

Idi na: **Vercel Dashboard → tvoj projekat → Settings → Environment Variables**

Dodaj sve varijable za `Production + Preview + Development`:

### Supabase (već postavljeno)
| Varijabla | Vrednost | Gde uzeti |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Settings → API → service_role |

### Site URL
| Varijabla | Vrednost |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://tvoj-projekat.vercel.app` (ili custom domen) |

### Mapbox (autocomplete + mapa)
| Varijabla | Vrednost | Gde uzeti |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | `pk.eyJ1...` | mapbox.com → Account → Tokens |

### Email — Resend
| Varijabla | Vrednost | Gde uzeti |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | `Zgradonačelnik <noreply@tvoj-domen.rs>` | Resend → Domains (verifikovati domen) |

> **Za test:** pre verifikacije domena koristi `onboarding@resend.dev` kao FROM adresu

### Storage
| Varijabla | Vrednost |
|---|---|
| `SUPABASE_STORAGE_BUCKET` | `zgradonacelnik-private` |

### Admin
| Varijabla | Vrednost |
|---|---|
| `ADMIN_EMAIL` | `dusan.sijacic2@gmail.com` |
| `TEST_EMAIL` | `dusan.sijacic2@gmail.com` ← **obrisati u produkciji!** |

### Plaćanje (Raiffeisen)
| Varijabla | Vrednost |
|---|---|
| `NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER` | `265-XXXXXXXXXXXXX-XX` (tvoj broj računa) |
| `NEXT_PUBLIC_PAYMENT_MODEL` | `97` |

### CAPTCHA — opciono (Cloudflare Turnstile)
| Varijabla | Vrednost |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Sa Cloudflare Turnstile dashboarda |
| `TURNSTILE_SECRET_KEY` | Sa Cloudflare Turnstile dashboarda |

> Ako ove dve nisu postavljene, CAPTCHA je automatski isključena — OK za MVP.

---

## 2. Supabase — Migracije

Idi na: **Supabase Dashboard → SQL Editor**

Pokreni ove fajlove **redom** (copy-paste sadržaj iz `supabase/migrations/`):

```
1. 0001_init.sql              ← osnovna shema (vjerovatno već pokrenuta)
2. 0002_registry_public_read.sql
3. 0003_pretraga_public_rpcs.sql
4. 0004_pretraga_registry_pagination.sql
5. 0005_registry_manager_reviews.sql
6. 0006_google_identity_phone.sql     ← telefon anti-Sybil
7. 0007_building_subscriptions_onboarding.sql  ← onboarding + pretplate
8. 0008_meeting_minutes_votes_address.sql      ← zapisnici, glasanje
9. 0009_buildings_mapbox_id.sql       ← Mapbox ID za zgrade
```

> Ako neka migracija kaže "already exists" — preskoči je.

---

## 3. Supabase — Storage bucket

Idi na: **Supabase Dashboard → Storage → New bucket**

- **Name:** `zgradonacelnik-private`
- **Public bucket:** ❌ isključeno (private)
- Klikni **Create bucket**

---

## 4. Supabase — Google OAuth

Idi na: **Supabase Dashboard → Authentication → Providers → Google**

**Treba ti Google Cloud Console:**

1. Otvori [console.cloud.google.com](https://console.cloud.google.com)
2. Kreiraj novi projekat ili koristi postojeći
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Application type: **Web application**
5. Authorized redirect URIs: `https://TVOJ_PROJEKAT_REF.supabase.co/auth/v1/callback`
6. Kopiraj **Client ID** i **Client Secret**

**Nazad u Supabase:**
- Unesite Client ID i Client Secret
- Enable Google provider ✅
- Sačuvajte

**Aktiviraj Google People API** (za telefon/adresu):
1. Google Cloud → APIs & Services → Library
2. Traži "People API" → Enable

> Bez People API: telefon neće biti sinhronizovan, ali login radi normalno.

---

## 5. Supabase — Site URL (za logout/redirect)

Idi na: **Supabase Dashboard → Authentication → URL Configuration**

- **Site URL:** `https://tvoj-projekat.vercel.app`
- **Redirect URLs:** dodaj `https://tvoj-projekat.vercel.app/**`

---

## 6. Resend — Email setup

1. Registruj se na [resend.com](https://resend.com) (besplatno: 3000 mejlova/mesec)
2. API Keys → Create API Key → kopiraj u `RESEND_API_KEY`
3. Domains → Add Domain → unesi tvoj domen
4. Dodaj DNS TXT record koji Resend prikaže (u registru domena)
5. Sačekaj verifikaciju (5-15 min)
6. Postavi `RESEND_FROM_EMAIL=Zgradonačelnik <noreply@tvoj-domen.rs>`

---

## 7. Mapbox — Access Token

1. Registruj se na [mapbox.com](https://mapbox.com) (besplatno: 50.000 zahteva/mesec)
2. Account → Tokens → Default public token (ili kreiraj novi)
3. Postavi u Vercel: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...`

---

## 8. CSV Import upravnika (registar)

Idi na: **`/admin/import`** (samo za admina)

1. Preuzmi CSV sa [usluge.pks.rs/portal/registar-upravnika-zgrada](https://usluge.pks.rs/portal/registar-upravnika-zgrada)
2. Uploaduj CSV → sistem importuje sve upravnike u `manager_registry` tabelu

---

## 9. Vercel — Redeploy

Nakon što dodate sve env varijable:

1. Vercel → Deployments → tačkice pored poslednjeg → **Redeploy**
2. Ili puši bilo koji commit na `main` granu

---

## 10. Provera — čeklista

- [ ] Mogu da se prijavim Google nalogom
- [ ] Nakon prijave, onboarding forma se prikaže
- [ ] Nakon onboardinga, vidim Dashboard
- [ ] Mogu da tražim zgradu po adresi (Mapbox autocomplete radi)
- [ ] Mogu da se pridružim zgradi
- [ ] Pretraga upravnika na `/pretraga` učitava podatke
- [ ] Mapa na `/pretraga/mapa` prikazuje kartu

---

## Česte greške

**"Onboarding se ne završava"**
→ Pokreni migracije 0007 u Supabase SQL Editoru

**"Autocomplete ne prikazuje sugestije"**
→ Proveri `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` u Vercel env vars

**"Mejlovi ne stižu"**
→ Proveri `RESEND_API_KEY` i `RESEND_FROM_EMAIL`, ili postavi `TEST_EMAIL` za redirect

**"Upload dokumenta ne radi"**
→ Kreiraj Storage bucket `zgradonacelnik-private` u Supabase

**"Login loop (stalno vraća na login)"**
→ Proveri Supabase → Auth → URL Configuration da je Site URL tačan
