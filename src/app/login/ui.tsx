"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginClient() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function signInWithGoogle() {
    const origin = window.location.origin;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <main className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-8 shadow-md">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">
          Prijava
        </h1>
        <p className="mt-2 text-sm leading-6 text-brand-navy/75">
          Prijavi se Google nalogom da bi koristio dashboard, dodavao recenzije i
          upravljao svojim zgradama (ako imaš prava).
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-6 w-full rounded-xl bg-brand-navy px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-navy-deep"
        >
          Nastavi sa Google
        </button>
      </main>
    </div>
  );
}

