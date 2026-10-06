import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchGooglePersonMe } from "@/lib/googlePeople";
import { normalizePhoneClient } from "@/lib/normalizePhone";

export type SyncResult = { ok: true } | { ok: false; reason: "phone_in_use" };

/**
 * Posle prijave (Google ili email link): napravi/ažuriraj profil preko service_role klijenta.
 * Zaštićene kolone (telefon za anti-sybil) korisnik ne može sam da menja — zato server.
 */
export async function syncProfileAfterLogin(session: Session): Promise<SyncResult> {
  const user: User = session.user;
  const admin = createSupabaseAdminClient();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const isGoogle = user.app_metadata?.provider === "google" || Boolean(session.provider_token);

  const { data: existing } = await admin
    .from("user_profiles")
    .select("user_id, first_name, last_name, display_name, google_phone_raw")
    .eq("user_id", user.id)
    .maybeSingle();

  let person: Awaited<ReturnType<typeof fetchGooglePersonMe>> = null;
  if (isGoogle && session.provider_token) {
    person = await fetchGooglePersonMe(session.provider_token).catch(() => null);
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  // Ime/prezime iz Google-a samo kao predlog — korisnik ih potvrđuje u onboardingu.
  const firstName = existing?.first_name ?? person?.givenName ?? str(meta.given_name);
  const lastName = existing?.last_name ?? person?.familyName ?? str(meta.family_name);
  const displayName =
    existing?.display_name ??
    person?.displayName ??
    str(meta.full_name) ??
    str(meta.name) ??
    ([firstName, lastName].filter(Boolean).join(" ") || null);

  const payload: Record<string, unknown> = {
    user_id: user.id,
    first_name: firstName,
    last_name: lastName,
    display_name: displayName,
  };

  if (person) {
    const phoneRaw = person.primaryPhoneRaw?.trim() || existing?.google_phone_raw || null;
    payload.google_phone_raw = phoneRaw;
    payload.google_phone_normalized = normalizePhoneClient(phoneRaw);
    payload.google_identity_synced_at = new Date().toISOString();
    if (person.primaryAddressFormatted) {
      payload.oauth_address_line = person.primaryAddressFormatted;
      payload.oauth_address_synced_at = new Date().toISOString();
    }
  }

  const { error } = await admin.from("user_profiles").upsert(payload, { onConflict: "user_id" });
  if (error?.code === "23505") return { ok: false, reason: "phone_in_use" };
  if (error) console.error("[profileSync]", error.message);
  return { ok: true };
}
