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

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-28 sm:py-36 text-center"
        style={{ background: "linear-gradient(135deg, #0a1f3d 0%, #0f2744 60%, #0d3b2e 100%)" }}
      >
        {/* Subtle grid overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

        {/* Glow blobs */}
        <div className="pointer-events-none absolute left-1/4 top-1/4 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-slate-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Platforma za stanare Srbije
          </span>

          <h1 className="mt-7 text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Znaš ko upravlja<br />
            <span style={{ background: "linear-gradient(90deg, #38bdf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              tvojom zgradom?
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            Pretraži licencirane upravnike iz državnog registra, prati finansije
            i glasaj o predlozima zajedno sa komšijama.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="group relative w-full overflow-hidden rounded-2xl px-8 py-4 text-sm font-bold text-white shadow-xl sm:w-auto"
              style={{ background: "linear-gradient(135deg, #16a34a, #059669)" }}
            >
              <span className="relative z-10">Prijavi se besplatno →</span>
              <div className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0" />
            </Link>
            <Link
              href="/pretraga"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-slate-300 backdrop-blur-sm hover:bg-white/10 hover:text-white sm:w-auto"
            >
              Pretraži upravnike
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { num: "3.500+", label: "licenciranih upravnika" },
              { num: "besplatno", label: "za stanare" },
              { num: "100%", label: "transparentno" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-white">{s.num}</div>
                <div className="mt-0.5 text-xs text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Sve što ti treba kao stanaru
          </h2>
          <p className="mt-4 text-slate-500">Jedna platforma — sve informacije o tvojoj zgradi.</p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: "📋", color: "bg-blue-50 text-blue-600",   title: "Državni registar",      desc: "Svi PKS licencirani upravnici u Srbiji. Pretraži, uporedi, proceni.", href: "/pretraga" },
            { icon: "⭐", color: "bg-amber-50 text-amber-600", title: "Recenzije stanara",     desc: "Ocenjuj po 5 dimenzija. Čitaj iskustva komšija. Donosi informisane odluke.", href: "/pretraga" },
            { icon: "💰", color: "bg-emerald-50 text-emerald-600", title: "Finansije zgrade", desc: "Pregled prihoda i rashoda. Ko šta plaća i zašto — transparentno.", href: "/login" },
            { icon: "🗳️", color: "bg-violet-50 text-violet-600", title: "Predlozi i glasanje", desc: "Predloži radove, glasaj zajedno sa komšijama. Demokratija u zgradi.", href: "/login" },
            { icon: "🗺️", color: "bg-sky-50 text-sky-600",     title: "Mapa upravnika",        desc: "Pronađi upravnike u svom komšiluku. Pretraga po radijusu.", href: "/pretraga/mapa" },
            { icon: "📁", color: "bg-rose-50 text-rose-600",   title: "Dokumenta i zapisnici", desc: "Skupštine, odluke, ugovori — sve dostupno verifikovanim stanarima.", href: "/login" },
          ].map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-200"
            >
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              <div className="mt-4 text-sm font-semibold text-brand-navy opacity-0 transition-opacity group-hover:opacity-100">
                Saznaj više →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-white px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Kako funkcioniše?</h2>
            <p className="mt-4 text-slate-500">Tri koraka do potpune transparentnosti.</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              { step: "01", title: "Prijavi se", desc: "Google nalog, bez lozinki. Registracija traje 30 sekundi." },
              { step: "02", title: "Pronađi zgradu", desc: "Ukucaj adresu — sistem pronalazi ili registruje tvoju zgradu automatski." },
              { step: "03", title: "Budi aktivan", desc: "Prati finansije, glasaj o predlozima, oceni upravnika." },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="text-5xl font-black text-slate-100">{s.step}</div>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section
        className="px-4 py-20 sm:px-6 text-center"
        style={{ background: "linear-gradient(135deg, #0f2744 0%, #0d3b2e 100%)" }}
      >
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Pridruži se već danas
          </h2>
          <p className="mt-4 text-slate-400">
            Besplatno za stanare. Bez kreditne kartice.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-bold text-brand-navy shadow-xl hover:bg-slate-50"
          >
            Nastavi sa Google →
          </Link>
        </div>
      </section>

    </div>
  );
}
