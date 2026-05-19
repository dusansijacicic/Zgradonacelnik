# Zgradonačelnik.rs — UX Brief

## Šta je aplikacija?

**Zgradonačelnik.rs** je web platforma za transparentno upravljanje stambenim zajednicama u Srbiji.

Stanari u Srbiji imaju zakonsko pravo da znaju ko upravlja njihovom zgradom, koliko košta i zašto — ali u praksi nemaju nikakav digitalni alat za to. Upravnici upravljaju novcem stanara (mesečni doprinosi, vanredni radovi) bez ikakve obaveze transparentnosti. Platforma to menja.

---

## Ko su korisnici? (3 persone)

### 1. Stanar / Vlasnik stana
- Živi u stambenoj zgradi, plaća mesečni doprinos upravniku
- Želi da zna kome plaća, koliko se troši i na šta
- Frustriran jer nema uvid u finansije, ne zna ko je tačno upravnik, ne može lako da se požali
- Tehnički: prosečan korisnik, 35–65 godina, koristi smartphone i laptop

### 2. Profesionalni upravnik (primaoc usluge, ne inicijator)
- Licencirani od strane PKS (Privredna komora Srbije), ima reg. broj
- Upravlja 10–50 zgrada istovremeno
- Dobija nalog automatski (importovan iz CSV registra) — ne mora sam da se registruje
- Može da prihvati platformu i koristi je za komunikaciju sa stanarima, ili da je ignoriše
- Motivacija za korišćenje: transparentnost gradi poverenje, lakše upravljanje predlozima

### 3. Admin (vlasnik platforme — trenutno samo jedan)
- Verifikuje stanare, aktivira premium pretplate, odobrava zahteve upravnika
- Ima pristup `/admin/*` stranicama

---

## Kako korisnik dolazi na platformu?

### Stanar — celokupan tok (Happy Path)

```
Landing page
  → Klik "Prijavi se besplatno"
    → Google OAuth (jedan klik, bez forme)
      → Onboarding (ime, prezime, tip korisnika — 30 sekundi)
        → Dashboard
          → "Pronađi svoju zgradu"
            → Mapbox autocomplete — ukuca adresu
              → Odabere adresu iz sugestija
                → Sistem proverava da li zgrada postoji u bazi
                  [Nova] → Kreira zgradu + dodaje korisnika kao "Stanar, neverifikovan"
                  [Postoji] → Dodaje korisnika kao "Stanar, neverifikovan"
                    → Redirect na stranicu zgrade
                      → Vidi: Oglasna tabla, Predlozi, Finansije (Premium), Zapisnici (Premium)
                        → Pošalje dokaz stanovanja (PDF/slika)
                          → Admin verifikuje → status postaje "Verifikovan"
                            → Može da glasa, predlaže radove, ostavi recenziju upravniku
```

### Upravnik — tok

```
Postoji u bazi (importovan iz CSV registra PKS)
  → Dobija link ili sam pronađe platformu
    → Prijavi se Google nalogom (email mora da se poklopi sa onim u registru)
      → Onboarding
        → Dashboard
          → Pronađe zgradu kojom upravlja
            → Pošalje zahtev za upravljanje (upload dokument ovlašćenja)
              → Admin odobri
                → Dobija ulogu "Upravnik" za tu zgradu
                  → Može da: kreira zapisnike, menja status predloga, kreira finansijske stavke
```

---

## Stranice i šta rade

### Javne stranice (bez prijave)
| URL | Svrha |
|---|---|
| `/` | Landing page — hero, features, CTA |
| `/login` | Google OAuth prijava |
| `/pretraga` | Pretraga upravnika — 3 tabele: Registar / Platforma / Zgrade |
| `/pretraga/mapa` | Mapa sa Mapbox-om — pretraga po radijusu od lokacije |
| `/registar/[id]` | Javni profil upravnika iz državnog registra |

### Zaštićene stranice (treba login)
| URL | Svrha |
|---|---|
| `/onboarding` | Popunjavanje profila posle prve prijave (blokirajući, mora pre dashboard-a) |
| `/dashboard` | Hub — moje zgrade, brze akcije |
| `/dashboard/moje-zgrade` | Lista svih zgrada korisnika sa statusima |
| `/dashboard/moje-zgrade/nova` | Dodaj/pronađi zgradu putem Mapbox autocomplete-a |
| `/dashboard/profil` | Nalog, telefon, adresa iz Google naloga |
| `/zgrade/[id]` | Stranica zgrade — navigacija do svih modula |
| `/zgrade/[id]/oglasna-tabla` | Obaveštenja od upravnika |
| `/zgrade/[id]/predlozi` | Predlozi radova + glasanje (Za/Protiv/Uzdržan) |
| `/zgrade/[id]/finansije` | ⭐ Premium — finansijski izveštaj zgrade |
| `/zgrade/[id]/zapisnici` | ⭐ Premium — zapisnici skupštine stanara |
| `/zgrade/[id]/dokumenta` | Upload i pregled dokumenata zgrade |
| `/zgrade/[id]/pretplata` | Status Premium pretplate, upute za uplatu |
| `/upravnik/[id]` | Profil upravnika na platformi (recenzije, ocene, zgrade) |
| `/upravnik/[id]/recenzija` | Forma za ocenjivanje upravnika (5 dimenzija) |

### Admin stranice
| URL | Svrha |
|---|---|
| `/admin` | Pregled statistika |
| `/admin/pretplate` | Aktivacija/deaktivacija Premium pretplata |
| `/admin/zgrade-upravnici` | Pregled zahteva za verifikaciju stanara i upravnika |
| `/admin/import` | Import CSV registra PKS |

---

## Ključne funkcionalnosti (šta već radi)

### ✅ Implementirano

**Autentikacija**
- Google OAuth (Supabase Auth)
- Anti-Sybil zaštita: Google People API povlači broj telefona, normalizuje ga i čuva kao unique — 1 telefon = 1 nalog
- Onboarding flow koji blokira pristup dashboardu dok se ne popuni profil

**Pretraga upravnika**
- Tabela: državni registar (3.500+ upravnika iz CSV importa)
- Tabela: korisnici platforme sa prosečnom ocenom i brojem recenzija
- Tabela: zgrade sa aktivnim upravnikom
- Filteri: ime, opština, grad, sortiranje po oceni/broju recenzija
- Paginacija
- Mapa: Mapbox GL JS, pretraga po radijusu (500m–10km), markeri sa popup-om

**Zgrade**
- Kreiranje/pronalazak zgrade putem Mapbox Geocoding Autocomplete
- Mapbox ID kao primarni deduplication ključ (jedna fizička adresa = jedan zapis)
- Koordinate (lat/lng) se snimaju direktno iz geocodera
- Membership sistem (stanar/vlasnik/zakupac/upravnik/član saveta)
- Verifikacioni statusi: unverified → pending (dokaz priložen) → verified / rejected

**Predlozi i glasanje**
- CRUD za predloge radova (kategorije: popravka, čišćenje, bezbednost...)
- Prioritet (nisko/srednje/visoko/hitno)
- Glasanje: Za/Protiv/Uzdržan, live counts, mogu da glasaš samo jednom, unvote kliknom na isti

**Zapisnici skupštine** (Premium)
- Kreiranje od strane upravnika (naslov, datum, mesto, agenda, odluke, broj prisutnih)
- Accordion prikaz za stanare

**Finansije** (Premium)
- Placeholder (UI postoji, backend u razvoju)

**Oglasna tabla**
- Obaveštenja od upravnika

**Dokumenta**
- Upload (PDF, JPG, PNG, max 10MB) u Supabase private Storage
- Signed URL za preuzimanje

**Premium pretplate**
- 500 RSD/mesec po zgradi (promo)
- Plaćanje: manuelna uplata na Raiffeisen račun sa unique ZGN-XXXXXXXX referentnim brojem
- Admin aktivira ručno u `/admin/pretplate`
- Email notifikacija upravniku kad se premium aktivira

**Email notifikacije** (Resend)
- Admin dobija mejl: novi zahtev za verifikaciju stanara, novi zahtev za premium
- Upravnik dobija mejl: nova recenzija, premium aktiviran, novi zapisnik
- TEST_EMAIL mod: sve ide na jednu adresu umesto prave

**Recenzije**
- 5 dimenzija: komunikacija, transparentnost finansija, odziv na probleme, kvalitet radova, profesionalnost
- Svaki verified stanar može da ostavi jednu recenziju po upravniku
- Prosechi prikazani na profilu upravnika i u pretrazi

---

## Šta trenutno NE radi ili je nedovršeno

### 🔴 Kritično (blokira korisnike)
- **Migracije nisu pokrenute** u Supabase produkciji → onboarding pada, verifikacija ne radi
- **Storage bucket ne postoji** → upload dokumenata ne radi

### 🟡 Nedovršeno (postoji UI, backend parcijalan)
- **Finansije zgrade** — samo premium gate, nema unosa stavki ni izveštaja
- **Verifikacija stanara** — flow postoji, ali admin UI za odobravanje je rudimentaran

### 🟢 Nije početo ali planirano
- Email notifikacije za oglas na oglasnoj tabli
- Automatsko vezivanje upravnika sa registrom (po email adresi)
- Stripe / Payten NestPay automatska naplata (trenutno manuelno)
- Mobile-first optimizacija navigacije

---

## Tehnički stack (za kontekst)

| Sloj | Tehnologija |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Backend | Next.js API Routes (server-side) |
| Baza | Supabase (PostgreSQL) |
| Auth | Supabase Auth + Google OAuth |
| Storage | Supabase Storage (private bucket) |
| Email | Resend |
| Mapa | Mapbox GL JS + Geocoding API |
| Hosting | Vercel |
| CAPTCHA | Cloudflare Turnstile (opciono) |

---

## Poslovni model

- **Stanari**: potpuno besplatno
- **Upravnici**: besplatno (registar je javni)
- **Zgrada Premium**: 500 RSD/mesec (promo, planirano 1.000 RSD)
  - Finansije, zapisnici, premium dokumenta
  - Plaća upravnik ili aktivan stanar
  - Manuelna uplata na račun, admin aktivira

---

## Šta bi UX dizajner trebalo da reši

### 1. Onboarding flow
- Korisnik nakon prijave ne razume gde je i šta dalje
- Nema jasnog "next step" indikatora
- Onboarding forma je funkcionalna ali ne motiviše korisnika

### 2. "Pronađi svoju zgradu" tok
- Mapbox autocomplete radi, ali korisnik ne zna šta da radi ako zgrade nema
- Nema objašnjenja šta znači "neverifikovan" i šta treba da uradi
- Upload dokaza stanovanja je zakopan — korisnici ga ne pronalaze

### 3. Zgrada page navigacija
- 6 kartica sa svim modulima — korisnik ne zna odakle da počne
- Premium locked content nije dovoljno jasno objasnjen
- Nema konteksta "ko je upravnik ove zgrade"

### 4. Pretraga
- Tri tabele u isto vreme zbunjuju korisnika (Registar / Platforma / Zgrade)
- Nije jasna razlika između "upravnik iz registra" i "upravnik na platformi"
- Mapa i lista nisu sinhronizovane

### 5. Premium konverzija
- Tok od "želim premium" do "platio sam" nije dovoljno jasan
- Manuelna uplata je složena za prosečnog korisnika
- Nema podsetsnika / praćenja statusa uplate

### 6. Mobile experience
- Sve stranice su responsive ali nisu optimizovane za mobile-first
- Header navigacija na mobitelu je zbijana
- Tabele u pretrazi se horizontalno skroluju — loše na touch

---

## Vizuelni identitet

- **Boje**: tamno plava (`#0f2744`), zelena (`#16a34a`), sky plava (`#38bdf8`)
- **Font**: Geist Sans (Vercel), monospace Geist Mono za kodove
- **Stil**: clean, professional, bez ilustracija, minimalistički
- **Logo**: postoji (JPEG), horizontalni format

---

## Linkovi

- **Produkcija**: [tvoj-projekat.vercel.app]
- **GitHub**: [github.com/dusansijacicic/Zgradonacelnik]
- **Supabase**: privatni projekat
- **Figma**: nema (otvoren za predloge)
