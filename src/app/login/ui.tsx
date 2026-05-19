"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginClient() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
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
    err === "phone_in_use" ? "Ovaj broj telefona je već vezan za drugi nalog."
    : err ? "Prijava nije uspela. Pokušaj ponovo."
    : null;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16"
      style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #f7f8fa 50%, #f0fdf4 100%)" }}>

      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-3xl bg-white px-8 py-10 shadow-xl shadow-slate-200/80 ring-1 ring-slate-100">
          <div className="text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-2xl shadow-md"
              style={{ background: "linear-gradient(135deg, #0f2744, #1a4a7a)" }}
            >
              🏢
            </div>
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">
              Dobrodošao
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Prijavi se da bi upravljao svojom zgradom
            </p>
          </div>

          {errMsg && (
            <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errMsg}
            </div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50 hover:shadow"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Nastavi sa Google
          </button>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-xs text-slate-400">Zašto Google?</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-slate-400">
            Koristimo Google za verifikaciju identiteta i broj telefona
            kao zaštitu od lažnih naloga (jedan broj = jedan nalog).
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-400">
          <span>Besplatno za stanare</span>
          <span>·</span>
          <span>Bez kreditne kartice</span>
          <span>·</span>
          <span>Odmah aktivno</span>
        </div>
      </div>
    </div>
  );
}
