import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

export async function SiteHeader() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  // Dark nav for landing page
  if (pathname === "/") {
    return (
      <header className="sticky top-0 z-40 border-b border-white/5" style={{ background: "#0f2744" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base">🏢</div>
            <span className="font-bold text-white">
              Zgradonačelnik<span className="text-sky-400">.rs</span>
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-0.5">
            <a href="#kako-radi" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
              Kako radi
            </a>
            <a href="#cene" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
              Cene
            </a>
            <Link href="/pretraga" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
              Pretraga
            </Link>
          </nav>
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "#38bdf8", color: "#0c2a4a" }}
          >
            Prijavi se
          </Link>
        </div>
      </header>
    );
  }

  let isLoggedIn = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;
  } catch { isLoggedIn = false; }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={isLoggedIn ? "/dashboard" : "/"} className="flex items-center">
          <Image
            src="/zgradonacelnik_logo.jpeg"
            alt="Zgradonačelnik.rs"
            width={720} height={260}
            sizes="(max-width: 640px) 200px, 280px"
            className="h-10 w-auto sm:h-12"
            priority
          />
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/pretraga" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Pretraga
          </Link>
          {isLoggedIn ? (
            <>
              <Link href="/dashboard/moje-zgrade" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Moje zgrade
              </Link>
              <Link href="/dashboard/profil" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Profil
              </Link>
              <div className="ml-1 h-5 w-px bg-slate-200" />
              <LogoutButton className="ml-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40" />
            </>
          ) : (
            <Link
              href="/login"
              className="ml-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-deep"
            >
              Prijava
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
