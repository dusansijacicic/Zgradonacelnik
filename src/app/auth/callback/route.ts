import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchGooglePersonMe } from "@/lib/googlePeople";
import { normalizePhoneClient } from "@/lib/normalizePhone";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? "/dashboard";
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";

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

  const { data: exchanged, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr || !exchanged.session) return response;

  const session = exchanged.session;
  const user = session.user;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("google_phone_raw, first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();

  let googlePerson: Awaited<ReturnType<typeof fetchGooglePersonMe>> = null;
  const providerToken = session.provider_token;
  if (providerToken) {
    try {
      googlePerson = await fetchGooglePersonMe(providerToken);
    } catch {
      googlePerson = null;
    }
  }

  const addrFromMeta =
    (typeof meta.formatted_address === "string" && meta.formatted_address.trim()) ||
    (() => {
      const addrObj = meta.address;
      if (
        typeof addrObj === "object" &&
        addrObj !== null &&
        typeof (addrObj as { formatted_address?: unknown }).formatted_address === "string"
      ) {
        return String((addrObj as { formatted_address: string }).formatted_address).trim() || null;
      }
      return null;
    })();

  const oauthAddressLine =
    googlePerson?.primaryAddressFormatted?.trim() || addrFromMeta || null;

  const givenFromPeople = googlePerson?.givenName;
  const familyFromPeople = googlePerson?.familyName;
  const givenFromMeta = typeof meta.given_name === "string" ? meta.given_name.trim() : null;
  const familyFromMeta = typeof meta.family_name === "string" ? meta.family_name.trim() : null;

  const firstName = givenFromPeople ?? givenFromMeta ?? existing?.first_name ?? null;
  const lastName = familyFromPeople ?? familyFromMeta ?? existing?.last_name ?? null;

  const displayFromPeople = googlePerson?.displayName?.trim() || null;
  const displayName =
    displayFromPeople ??
    (typeof meta.full_name === "string" ? meta.full_name : null) ??
    (typeof meta.name === "string" ? meta.name : null) ??
    (() => {
      const joined = [firstName, lastName].filter(Boolean).join(" ").trim();
      return joined || user.email || "Korisnik";
    })();

  const phoneRawMerged =
    (googlePerson?.primaryPhoneRaw && googlePerson.primaryPhoneRaw.trim()) ||
    existing?.google_phone_raw ||
    null;
  const phoneNorm = normalizePhoneClient(phoneRawMerged);

  const payload: Record<string, unknown> = {
    user_id: user.id,
    display_name: displayName,
    first_name: firstName,
    last_name: lastName,
    google_phone_raw: phoneRawMerged,
    google_phone_normalized: phoneNorm,
  };

  if (googlePerson) {
    payload.google_identity_synced_at = new Date().toISOString();
  }

  if (oauthAddressLine) {
    payload.oauth_address_line = oauthAddressLine;
    payload.oauth_address_synced_at = new Date().toISOString();
  }

  const { error: upErr } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });

  if (upErr?.code === "23505") {
    await supabase.auth.signOut();
    const errUrl = new URL("/login", url.origin);
    errUrl.searchParams.set("error", "phone_in_use");
    return NextResponse.redirect(errUrl);
  }

  if (upErr) {
    await supabase.auth.signOut();
    const errUrl = new URL("/login", url.origin);
    errUrl.searchParams.set("error", "profile_sync");
    return NextResponse.redirect(errUrl);
  }

  return response;
}
