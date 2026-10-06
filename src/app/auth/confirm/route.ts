import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { syncProfileAfterLogin } from "@/lib/profileSync";
import { safeNextPath } from "@/lib/api";

/**
 * Email magic link preko token_hash (radi i kad korisnik otvori link na drugom uređaju).
 * Supabase → Auth → Email Templates → Magic Link / Confirm signup:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;

  // RedirectTo može biti pun URL (…/auth/callback?next=/x) — izvuci samo bezbednu putanju.
  let nextRaw = url.searchParams.get("next");
  if (nextRaw?.startsWith("http")) {
    try {
      const parsed = new URL(nextRaw);
      nextRaw = parsed.searchParams.get("next") ?? parsed.pathname;
    } catch {
      nextRaw = null;
    }
  }
  const next = safeNextPath(nextRaw);

  const response = NextResponse.redirect(new URL(next, url.origin));
  const loginError = (reason: string) => {
    const errUrl = new URL("/login", url.origin);
    errUrl.searchParams.set("error", reason);
    return NextResponse.redirect(errUrl);
  };

  if (!tokenHash) return loginError("missing_token");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.session) return loginError("link_expired");

  const sync = await syncProfileAfterLogin(data.session);
  if (!sync.ok) {
    await supabase.auth.signOut();
    return loginError(sync.reason);
  }

  return response;
}
