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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Prijava
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Prijavi se Google nalogom da bi koristio dashboard, dodavao recenzije i
          upravljao svojim zgradama (ako imaš prava).
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-6 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Nastavi sa Google
        </button>
      </main>
    </div>
  );
}

