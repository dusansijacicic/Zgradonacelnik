import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { syncProfileAfterLogin } from "@/lib/profileSync";
import { safeNextPath } from "@/lib/api";

/** OAuth (Google) i PKCE email link (?code=...). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  const response = NextResponse.redirect(new URL(next, url.origin));
  const loginError = (reason: string) => {
    const errUrl = new URL("/login", url.origin);
    errUrl.searchParams.set("error", reason);
    return NextResponse.redirect(errUrl);
  };

  if (!code) return loginError("missing_code");

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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return loginError("exchange_failed");

  const sync = await syncProfileAfterLogin(data.session);
  if (!sync.ok) {
    await supabase.auth.signOut();
    return loginError(sync.reason);
  }

  return response;
}
