"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LogoutButton } from "./LogoutButton";

type Auth = { loggedIn: boolean; isManager: boolean; isAdmin: boolean };

/**
 * Klijentsko zaglavlje: stanje prijave čita iz lokalne sesije u browseru (bez mrežnog poziva
 * na serveru), pa sve javne stranice mogu da budu statične i da se služe sa CDN-a.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [auth, setAuth] = useState<Auth>({ loggedIn: false, isManager: false, isAdmin: false });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function load(userId: string | null) {
      if (!userId) {
        if (!cancelled) setAuth({ loggedIn: false, isManager: false, isAdmin: false });
        return;
      }
      if (!cancelled) setAuth((a) => ({ ...a, loggedIn: true }));
      const { data } = await supabase.from("user_profiles").select("user_type, is_admin").eq("user_id", userId).maybeSingle();
      if (!cancelled) {
        setAuth({ loggedIn: true, isManager: data?.user_type === "professional_manager", isAdmin: Boolean(data?.is_admin) });
      }
    }

    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

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
          <nav className="hidden items-center gap-0.5 sm:flex">
            <a href="#kako-radi" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Kako radi
            </a>
            <a href="#cene" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Cene
            </a>
            <Link href="/pretraga" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Pretraga
            </Link>
            <Link href="/blog" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Blog
            </Link>
          </nav>
          <Link
            href={auth.loggedIn ? "/dashboard" : "/login"}
            className="rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "#38bdf8", color: "#0c2a4a" }}
          >
            {auth.loggedIn ? "Moj nalog" : "Prijavi se"}
          </Link>
        </div>
      </header>
    );
  }

  const link = "rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-3";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href={auth.loggedIn ? "/dashboard" : "/"} className="flex shrink-0 items-center">
          <Image
            src="/zgradonacelnik_logo.jpeg"
            alt="Zgradonačelnik.rs"
            width={720}
            height={260}
            sizes="(max-width: 640px) 140px, 280px"
            className="h-9 w-auto sm:h-12"
            priority
          />
        </Link>

        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          <Link href="/pretraga" className={link}>
            Pretraga
          </Link>
          <Link href="/blog" className={`${link} hidden sm:inline-block`}>
            Blog
          </Link>
          {auth.loggedIn ? (
            <>
              <Link href="/dashboard/moje-zgrade" className={link}>
                Zgrade
              </Link>
              {auth.isManager ? (
                <Link href="/manager" className={link}>
                  Upravnik
                </Link>
              ) : null}
              {auth.isAdmin ? (
                <Link href="/admin" className={link}>
                  Admin
                </Link>
              ) : null}
              <Link href="/dashboard/profil" className={`${link} hidden sm:inline-block`}>
                Profil
              </Link>
              <LogoutButton className="ml-1 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40" />
            </>
          ) : (
            <Link
              href="/login"
              className="ml-1 shrink-0 rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-deep"
            >
              Prijava
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
