import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HomeProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: HomeProps) {
  const sp = await searchParams;
  const code = sp.code;
  if (typeof code === "string" && code.length > 0) {
    const next = typeof sp.next === "string" ? sp.next : "/dashboard";
    redirect(`/auth/callback?code=${code}&next=${encodeURIComponent(next)}`);
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  } catch { /* landing */ }

  return (
    <div className="flex flex-1 flex-col">

      {/* ── HERO ── */}
      <section
        className="relative flex flex-col items-center overflow-hidden px-4 pb-0 pt-20 text-center sm:pt-28"
        style={{ background: "linear-gradient(160deg, #071829 0%, #0f2744 55%, #0c3020 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="pointer-events-none absolute left-1/3 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/8 px-4 py-1.5 text-xs font-medium text-sky-300">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            3.500+ upravnika iz PKS registra
          </div>

          <h1 className="mx-auto mt-7 max-w-2xl text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Transparentnost vaše{" "}
            <span style={{ background: "linear-gradient(90deg, #38bdf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              stambene zajednice
            </span>{" "}
            na jednom mestu
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-slate-400">
            Znajte ko upravlja vašom zgradom, koliko košta i na šta se troši.
            <br className="hidden sm:block" />
            Besplatno za sve stanare.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-7 py-3.5 text-sm font-bold text-white shadow-lg sm:w-auto"
              style={{ background: "linear-gradient(135deg, #16a34a, #059669)" }}
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              Prijavi se besplatno
              <div className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0" />
            </Link>
            <Link
              href="/pretraga"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-300 backdrop-blur-sm hover:bg-white/10 hover:text-white sm:w-auto"
            >
              Pretraži upravnike →
            </Link>
          </div>

          {/* Mini dashboard mockup */}
          <div className="relative mx-auto mt-14 max-w-2xl">
            <div className="absolute -inset-6 rounded-3xl bg-sky-500/8 blur-2xl" />
            <div className="relative overflow-hidden rounded-t-2xl shadow-2xl ring-1 ring-white/10">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 bg-[#162a47] px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                </div>
                <div className="mx-3 flex-1">
                  <div className="rounded-md bg-[#0d2138] px-3 py-1 text-center text-xs text-slate-500">
                    zgradonacelnik.rs/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard body */}
              <div className="select-none bg-[#f7f8fa] p-4 text-left">
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Moje zgrade",       value: "2",     sub: "✓ Verifikovana",  sc: "text-emerald-500" },
                    { label: "Otvoreni predlozi",  value: "5",     sub: "↑ 2 nova",        sc: "text-amber-500" },
                    { label: "Mesečni doprinos",   value: "2.400", sub: "RSD",             sc: "text-sky-500" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-white p-2.5 shadow-sm sm:p-3">
                      <div className="text-[9px] text-slate-400 sm:text-[10px]">{s.label}</div>
                      <div className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">{s.value}</div>
                      <div className={`text-[9px] font-medium sm:text-[10px] ${s.sc}`}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="mb-2.5 overflow-hidden rounded-xl bg-white shadow-sm">
                  {[
                    { addr: "Bulevar oslobođenja 42, Novi Sad", meta: "Upravnik: Petar Nikolić · Premium aktivan", badge: "Verifikovan", bc: "bg-emerald-50 text-emerald-700" },
                    { addr: "Cara Dušana 17, Beograd",          meta: "Čeka verifikaciju · Dokaz poslat",         badge: "Na čekanju", bc: "bg-amber-50 text-amber-700" },
                  ].map((b, i) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 ${i === 0 ? "border-b border-slate-50" : ""}`}>
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="truncate text-[10px] font-semibold text-slate-900 sm:text-xs">{b.addr}</div>
                        <div className="text-[9px] text-slate-400 sm:text-[10px]">{b.meta}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold sm:text-[10px] ${b.bc}`}>{b.badge}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm sm:px-3.5 sm:py-2.5">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="truncate text-[10px] font-semibold text-slate-900 sm:text-xs">Predlog: zamena lifta — Glasanje otvoreno</div>
                    <div className="text-[9px] text-slate-400 sm:text-[10px]">12 glasova · Rok: 15.06.2026.</div>
                  </div>
                  <button className="shrink-0 rounded-lg px-2.5 py-1 text-[9px] font-bold text-white sm:px-3 sm:text-[10px]" style={{ background: "#0f2744" }}>Glasaj</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="border-b border-slate-100 bg-white py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 sm:gap-x-12 sm:px-6">
          {([
            { icon: "db",     text: "3.500+ upravnika u bazi",  color: "text-sky-500" },
            { icon: "shield", text: "PKS verifikovani podaci",   color: "text-emerald-500" },
            { icon: "star",   text: "Recenzije stanara",         color: "text-amber-500" },
            { icon: "lock",   text: "Sigurna prijava (Google)",  color: "text-slate-400" },
          ] as const).map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm text-slate-500">
              <TrustIcon type={item.icon} className={`h-4 w-4 shrink-0 ${item.color}`} />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funkcionalnosti" className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
        <SectionBadge icon="grid" label="Funkcionalnosti" />
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Sve što vaša zgrada treba
        </h2>
        <p className="mt-3 max-w-xl text-slate-500">
          Od glasanja o radovima do finansijskih izveštaja — na jednoj platformi.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-slate-200 hover:shadow-md">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${f.iconBg}`}>
                <svg className={`h-6 w-6 ${f.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.iconPath} />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900">{f.title}</h3>
                  {f.premium && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      ⭐ Premium
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        id="kako-radi"
        className="px-4 py-20 sm:px-6"
        style={{ background: "linear-gradient(160deg, #071829 0%, #0f2744 60%, #0a2d1e 100%)" }}
      >
        <div className="mx-auto max-w-5xl">
          <SectionBadge icon="rocket" label="Kako početi" dark />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Za 3 minuta do transparentnosti
          </h2>
          <p className="mt-3 text-slate-400">Bez formulara, bez čekanja. Samo Google nalog.</p>

          <div className="mt-12 grid gap-8 sm:grid-cols-4">
            {[
              { n: "1", title: "Prijavite se",         desc: "Google OAuth — jedan klik, nema lozinke" },
              { n: "2", title: "Nađite zgradu",        desc: "Pretražite adresu na mapi ili unesite ručno" },
              { n: "3", title: "Potvrdite stanovanje", desc: "Pošaljite dokaz — admin verifikuje za 24h" },
              { n: "4", title: "Koristite platformu",  desc: "Glasajte, pratite, ocenjujte — besplatno" },
            ].map((s, i) => (
              <div key={s.n} className="relative">
                {i < 3 && (
                  <div className="absolute left-[calc(100%_-_1rem)] top-5 hidden w-8 sm:block">
                    <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sm font-bold text-sky-300 ring-1 ring-sky-500/25">
                  {s.n}
                </div>
                <h3 className="mt-4 font-bold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PERSONAS ── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
        <SectionBadge icon="users" label="Za koga je" />
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Platforma koja radi za sve
        </h2>
        <p className="mt-3 text-slate-500">Stanari, vlasnici ili upravnici — svako dobija ono što mu treba.</p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <PersonaCard
            gradient="linear-gradient(90deg, #0f2744, #38bdf8)"
            emoji="🏠"
            iconBg="bg-blue-50"
            tag="Stanar / Vlasnik"
            name="Ana, 42 god."
            desc="Plaća mesečni doprinos ali ne zna ko je njen upravnik ni na šta troši novac."
            tags={["Uvid u finansije", "Glasanje", "Besplatno"]}
            tagCls="bg-blue-50 text-blue-700"
          />
          <PersonaCard
            gradient="linear-gradient(90deg, #16a34a, #34d399)"
            emoji="📊"
            iconBg="bg-emerald-50"
            tag="Profesionalni Upravnik"
            name="Petar Nikolić"
            desc="Licenciran od PKS, upravlja 20+ zgrada. Želi da gradi poverenje i smanji papirolog."
            tags={["Automatski u bazi", "Zapisnici", "Recenzije"]}
            tagCls="bg-emerald-50 text-emerald-700"
          />
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="cene" className="border-t border-slate-100 bg-slate-50 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <SectionBadge icon="coin" label="Cene" />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Jednostavno i transparentno
          </h2>
          <p className="mt-3 text-slate-500">
            Za stanare je uvek besplatno. Premium otključava napredne funkcionalnosti.
          </p>

          <div className="mt-10 grid max-w-2xl gap-5 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Osnovni plan</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-5xl font-black text-slate-900">0</span>
                <span className="text-xl font-semibold text-slate-400">RSD</span>
              </div>
              <div className="mt-1 text-sm text-slate-400">zauvek besplatno</div>
              <ul className="mt-7 space-y-3">
                {["Pretraga upravnika", "Predlozi i glasanje", "Oglasna tabla", "Ocenjivanje upravnika"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="relative overflow-hidden rounded-2xl p-7 shadow-lg" style={{ background: "linear-gradient(140deg, #0f2744 0%, #0d3826 100%)" }}>
              <span className="absolute right-5 top-5 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black text-amber-900">POPULAR</span>
              <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Premium zgrada</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-5xl font-black text-white">500</span>
                <span className="text-xl font-semibold text-slate-400">RSD</span>
              </div>
              <div className="mt-1 text-sm text-slate-400">mesečno po zgradi</div>
              <ul className="mt-7 space-y-3">
                {["Sve iz osnovnog plana", "Finansijski izveštaji", "Zapisnici skupštine", "Premium dokumenta"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-200">
                    <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="mt-8 flex w-full items-center justify-center rounded-xl bg-white py-3 text-sm font-bold text-brand-navy transition hover:bg-slate-50"
              >
                Aktiviraj Premium
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="px-4 py-24 text-center sm:px-6"
        style={{ background: "linear-gradient(160deg, #071829 0%, #0f2744 60%, #0a2d1e 100%)" }}
      >
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Vaša zgrada zaslužuje transparentnost
          </h2>
          <p className="mt-4 text-slate-400">
            Pridružite se stanarima koji već prate kako se troši njihov novac.
          </p>
          <Link
            href="/login"
            className="mt-9 inline-flex items-center gap-2.5 rounded-2xl bg-white px-8 py-4 text-sm font-bold text-brand-navy shadow-xl transition hover:bg-slate-50"
          >
            <GoogleIcon className="h-4 w-4 shrink-0" />
            Prijavite se besplatno
          </Link>
        </div>
      </section>

    </div>
  );
}

/* ── Sub-components ── */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TrustIcon({ type, className }: { type: "db" | "shield" | "star" | "lock"; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    db: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
      </>
    ),
    shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    star: <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
    lock: <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
  };
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {paths[type]}
    </svg>
  );
}

function SectionBadge({ icon, label, dark }: { icon: string; label: string; dark?: boolean }) {
  const icons: Record<string, string> = {
    grid:   "M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z",
    rocket: "M13 10V3L4 14h7v7l9-11h-7z",
    users:  "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    coin:   "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };
  if (dark) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-sky-300">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icons[icon] ?? icons.grid} />
        </svg>
        {label}
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 shadow-sm">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icons[icon] ?? icons.grid} />
      </svg>
      {label}
    </div>
  );
}

function PersonaCard({ gradient, emoji, iconBg, tag, name, desc, tags, tagCls }: {
  gradient: string; emoji: string; iconBg: string; tag: string;
  name: string; desc: string; tags: string[]; tagCls: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="h-1.5 w-full" style={{ background: gradient }} />
      <div className="p-6">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-xl ${iconBg}`}>{emoji}</div>
        <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{tag}</div>
        <h3 className="mt-1 text-xl font-bold text-slate-900">{name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className={`rounded-full px-3 py-1 text-xs font-medium ${tagCls}`}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Feature data ── */

const FEATURES = [
  {
    iconPath: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    iconBg: "bg-sky-50", iconColor: "text-sky-600",
    title: "Pretraga upravnika",
    desc: "Pronađite ko upravlja vašom zgradom iz PKS registra. Proverite ocene i recenzije stanara.",
    premium: false,
  },
  {
    iconPath: "M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5",
    iconBg: "bg-blue-50", iconColor: "text-blue-600",
    title: "Predlozi i glasanje",
    desc: "Predložite radove, glasajte Za/Protiv/Uzdržan. Pratite status u realnom vremenu.",
    premium: false,
  },
  {
    iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
    title: "Finansije zgrade",
    desc: "Transparentni prihodi i rashodi. Vidite tačno na šta se troši mesečni doprinos.",
    premium: true,
  },
  {
    iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    iconBg: "bg-violet-50", iconColor: "text-violet-600",
    title: "Zapisnici skupštine",
    desc: "Sve odluke stanara na jednom mestu. Pristupite istoriji zapisnika bez papira.",
    premium: true,
  },
  {
    iconPath: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z",
    iconBg: "bg-orange-50", iconColor: "text-orange-600",
    title: "Oglasna tabla",
    desc: "Obaveštenja od upravnika direktno u aplikaciji. Nikad više propuštenih informacija.",
    premium: false,
  },
  {
    iconPath: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
    iconBg: "bg-amber-50", iconColor: "text-amber-600",
    title: "Ocene upravnika",
    desc: "Ocenite upravnika u 5 dimenzija. Pomozite drugima da donesu informisanu odluku.",
    premium: false,
  },
];
