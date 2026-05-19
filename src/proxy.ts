import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/dashboard", "/manager", "/admin"];
const ONBOARDING_PATH = "/onboarding";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Forward current pathname so Server Components (e.g. SiteHeader) can read it via headers()
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const isOnboarding = pathname === ONBOARDING_PATH;
  const requiresAuth =
    isOnboarding ||
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  if (!requiresAuth) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For non-onboarding protected routes, check if onboarding is done
  if (!isOnboarding) {
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();

    // If DB error (e.g. column missing before migration), allow through rather than infinite loop
    if (!profileErr && !profile?.onboarding_completed) {
      return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
