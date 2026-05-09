import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const response = NextResponse.redirect(new URL(next, url.origin));

  if (!code) return response;

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return response;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const addrObj = meta.address;
  const oauthAddressLine =
    (typeof meta.formatted_address === "string" && meta.formatted_address.trim()) ||
    (typeof addrObj === "object" &&
      addrObj !== null &&
      typeof (addrObj as { formatted_address?: unknown }).formatted_address === "string" &&
      String((addrObj as { formatted_address: string }).formatted_address).trim()) ||
    null;

  // Ensure user_profiles exists (RLS allows "insert self")
  await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      display_name:
        (typeof meta.full_name === "string" ? meta.full_name : null) ??
        (typeof meta.name === "string" ? meta.name : null) ??
        user.email ??
        "Korisnik",
      ...(oauthAddressLine
        ? {
            oauth_address_line: oauthAddressLine,
            oauth_address_synced_at: new Date().toISOString(),
          }
        : {}),
    },
    { onConflict: "user_id" },
  );

  return response;
}

