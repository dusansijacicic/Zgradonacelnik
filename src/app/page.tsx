import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const sp = await searchParams;
  const code = sp.code;
  if (typeof code === "string" && code.length > 0) {
    const next = typeof sp.next === "string" ? sp.next : "/dashboard";
    const q = new URLSearchParams();
    q.set("code", code);
    q.set("next", next);
    redirect(`/auth/callback?${q.toString()}`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  } catch { /* nastavi na landing */ }

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy px-4 py-20 sm:py-28">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #5eb3d4 0%, transparent 60%), radial-gradient(circle at 80% 20%, #1a9b52 0%, transparent 50%)" }} />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-4 py-1.5 text-xs font-medium text-brand-sky">
            Transparentnost u upravljanju zgradama
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Znaš ko upravlja<br />
            <span className="text-brand-sky">tvojom zgradom?</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/70">
            Pretraži licencirane upravnike, prati finansije zgrade, glasaj o
            predlozima i ostavi recenziju. Sve na jednom mestu.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="w-full rounded-2xl bg-brand-green px-8 py-4 text-center text-sm font-semibold text-white shadow-lg transition hover:bg-brand-green-hover sm:w-auto"
            >
              Prijavi se besplatno →
            </Link>
            <Link
              href="/pretraga"
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-8 py-4 text-center text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
            >
              Pretraži upravnike
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">
            Sve što ti treba kao stanaru
          </h2>
          <p className="mt-3 text-sm text-zinc-500">
            Platforma za stanare, vlasnike stanova i profesionalne upravnike.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: "📋",
              title: "Državni registar",
              desc: "Svi PKS licencirani upravnici u Srbiji. Pretraži po imenu, mestu i oceni.",
              href: "/pretraga",
              cta: "Pretraži →",
              color: "bg-blue-50 border-blue-100",
            },
            {
              icon: "⭐",
              title: "Recenzije stanara",
              desc: "Oceni upravnika po 5 dimenzija. Čitaj iskustva komšija pre nego što potpišeš ugovor.",
              href: "/pretraga",
              cta: "Vidi ocene →",
              color: "bg-amber-50 border-amber-100",
            },
            {
              icon: "🏢",
              title: "Dnevnik zgrade",
              desc: "Oglasna tabla, predlozi radova sa glasanjem, finansijski izveštaji i zapisnici skupštine.",
              href: "/login",
              cta: "Započni →",
              color: "bg-emerald-50 border-emerald-100",
            },
            {
              icon: "🗺️",
              title: "Mapa upravnika",
              desc: "Pronađi upravnike u svom kvartu. Pretraži po radijusu od tvoje lokacije.",
              href: "/pretraga/mapa",
              cta: "Otvori mapu →",
              color: "bg-violet-50 border-violet-100",
            },
            {
              icon: "📄",
              title: "Dokumenta zgrade",
              desc: "Čuvaj ugovore, odluke i tehničku dokumentaciju na jednom mestu.",
              href: "/login",
              cta: "Saznaj više →",
              color: "bg-zinc-50 border-zinc-200",
            },
            {
              icon: "⚖️",
              title: "Pravna osnova",
              desc: "Svi podaci su transparentni i mogu služiti kao osnova za pravne postupke.",
              href: "/login",
              cta: "Registruj se →",
              color: "bg-rose-50 border-rose-100",
            },
          ].map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className={`group rounded-2xl border p-6 transition hover:shadow-md ${f.color}`}
            >
              <div className="text-3xl">{f.icon}</div>
              <div className="mt-4 font-semibold text-zinc-900">{f.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.desc}</p>
              <div className="mt-4 text-sm font-medium text-brand-navy group-hover:underline">
                {f.cta}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA bar */}
      <section className="bg-brand-navy/5 border-t border-brand-sky/20 px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-bold text-brand-navy sm:text-2xl">
            Registruj se za 30 sekundi
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Potreban ti je samo Google nalog. Nema lozinki, nema komplikovane forme.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center rounded-2xl bg-brand-navy px-8 py-3.5 text-sm font-semibold text-white shadow transition hover:bg-brand-navy-deep"
          >
            Nastavi sa Google →
          </Link>
        </div>
      </section>
    </div>
  );
}
