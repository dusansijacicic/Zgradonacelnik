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
        scopes: [
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/user.phonenumbers.read",
          "https://www.googleapis.com/auth/user.addresses.read",
        ].join(" "),
        queryParams: { access_type: "offline" },
      },
    });
  }

  const err = params.get("error");
  const errMsg =
    err === "phone_in_use"
      ? "Ovaj broj telefona je već vezan za drugi nalog. Kontaktiraj podršku ako je greška."
      : err
      ? "Prijava nije uspela. Pokušaj ponovo."
      : null;

  return (
    <div className="flex flex-1 items-center justify-center bg-brand-navy/5 px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-3xl border border-border-subtle bg-white px-8 py-10 shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy text-2xl text-white">
              🏢
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-navy">
              Dobrodošao
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Prijavi se da bi upravljao svojom zgradom
            </p>
          </div>

          {errMsg && (
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {errMsg}
            </div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 hover:shadow"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Nastavi sa Google
          </button>

          <p className="mt-6 text-center text-xs leading-5 text-zinc-400">
            Prijavom prihvataš naše uslove korišćenja. Tražimo pristup imenu,
            telefonu i adresi iz Google naloga radi zaštite od zloupotreba.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Već imate nalog?{" "}
          <span className="font-medium text-brand-navy">Samo se prijavite gore.</span>
        </p>
      </div>
    </div>
  );
}
