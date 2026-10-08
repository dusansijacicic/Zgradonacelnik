import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ONBOARDING_PATH = "/onboarding";

/**
 * Radi SAMO na zaštićenim rutama (vidi matcher) — javne stranice idu direktno sa CDN-a.
 * Prijava se proverava lokalno (getClaims verifikuje JWT bez poziva Supabase Auth servera
 * kada projekat koristi asimetrične JWT ključeve; inače automatski pada na getUser).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname !== ONBOARDING_PATH) {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("onboarding_completed")
      .eq("user_id", userId)
      .maybeSingle();
    // Greška u bazi: pusti dalje (stranica sama proverava), da ne nastane beskonačna petlja.
    if (!error && !profile?.onboarding_completed) {
      return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/manager/:path*", "/admin/:path*", "/zgrade/:path*", "/onboarding"],
};
