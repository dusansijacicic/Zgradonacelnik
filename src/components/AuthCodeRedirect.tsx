"use client";

import { useEffect } from "react";

/**
 * Supabase ponekad vrati korisnika na početnu stranu sa ?code=… (kad redirect URL nije na listi).
 * Ovo se rešava u browseru da bi početna strana ostala statična (CDN keš).
 */
export function AuthCodeRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    const nextRaw = params.get("next") ?? "/dashboard";
    const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";
    window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
  }, []);
  return null;
}
