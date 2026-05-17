import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

export async function SiteHeader() {
  let isLoggedIn = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;
  } catch {
    isLoggedIn = false;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-brand-sky/30 bg-surface/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-3 md:py-4">
        <Link
          href={isLoggedIn ? "/dashboard" : "/"}
          className="flex min-w-0 justify-center sm:justify-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green rounded-lg"
        >
          <Image
            src="/zgradonacelnik_logo.jpeg"
            alt="Zgradonačelnik.rs"
            width={720}
            height={260}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 420px, 480px"
            className="h-[3.35rem] w-auto max-w-full object-contain object-center sm:h-[4rem] sm:object-left md:h-[4.5rem] lg:h-[4.75rem]"
            priority
          />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-1 sm:justify-end sm:gap-1.5">
          <Link
            href="/pretraga"
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-sky-muted hover:text-brand-navy-deep sm:px-3"
          >
            Pretraga
          </Link>
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard/moje-zgrade"
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-sky-muted hover:text-brand-navy-deep sm:px-3"
              >
                Moje zgrade
              </Link>
              <Link
                href="/dashboard/profil"
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-sky-muted hover:text-brand-navy-deep sm:px-3"
              >
                Profil
              </Link>
              <LogoutButton className="rounded-lg px-2.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-sky-muted hover:text-brand-navy-deep sm:px-3 disabled:opacity-50" />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-navy-deep sm:px-4"
            >
              Prijava
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
