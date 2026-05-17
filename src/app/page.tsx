import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const sp = await searchParams;

  // Supabase ponekad vrati na /?code=… umesto na /auth/callback
  const code = sp.code;
  if (typeof code === "string" && code.length > 0) {
    const next = typeof sp.next === "string" ? sp.next : "/dashboard";
    const q = new URLSearchParams();
    q.set("code", code);
    q.set("next", next);
    redirect(`/auth/callback?${q.toString()}`);
  }

  // Ako je ulogovan, idi na dashboard
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  } catch {
    // nastavi na landing
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
      <main className="w-full max-w-3xl rounded-2xl border border-border-subtle bg-surface p-6 shadow-md sm:p-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium tracking-wide text-brand-sky">
            Zgradonačelnik.rs
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">
            Transparentno upravljanje stambenim zajednicama
          </h1>
          <p className="text-base leading-7 text-brand-navy/80">
            Pretraži profesionalne upravnike, prati rad svog upravnika, glasaj o
            predlozima i ostavi recenziju. Sve na jednom mestu.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/pretraga"
            className="rounded-xl border border-brand-sky/40 bg-brand-sky-muted px-4 py-4 text-center text-sm font-medium text-brand-navy transition-colors hover:border-brand-sky hover:bg-brand-sky/15"
          >
            Pretraga upravnika →
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-brand-navy px-4 py-4 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-navy-deep"
          >
            Prijava (Google) →
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3 text-center text-xs text-brand-navy/60">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <div className="text-2xl font-bold text-brand-navy">📋</div>
            <div className="mt-1 font-medium">Državni registar</div>
            <div>PKS licencirani upravnici</div>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <div className="text-2xl font-bold text-brand-navy">⭐</div>
            <div className="mt-1 font-medium">Recenzije stanara</div>
            <div>Ocenjuj i čitaj iskustva</div>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <div className="text-2xl font-bold text-brand-navy">🏢</div>
            <div className="mt-1 font-medium">Dnevnik zgrade</div>
            <div>Finansije, glasanje, zapisnici</div>
          </div>
        </div>
      </main>
    </div>
  );
}
