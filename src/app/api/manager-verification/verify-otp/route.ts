import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, jsonError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { otpMatches } from "@/lib/otp";
import { claimRegistry } from "@/lib/registryClaim";

const bodySchema = z.object({
  request_id: z.string().uuid(),
  otp: z.string().trim().regex(/^\d{6}$/),
});

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400, "Kod ima 6 cifara.");

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("manager_verification_requests")
    .select("id, user_id, registry_id, status, otp_hash, otp_expires_at, attempts_count")
    .eq("id", body.data.request_id)
    .maybeSingle();

  if (!row || row.user_id !== user.id || !row.registry_id) return jsonError("not_found", 404);
  if (row.status !== "pending") return jsonError("not_pending", 400, "Zahtev više nije aktivan. Pošalji novi kod.");

  const attempts = (row.attempts_count ?? 0) + 1;
  if (!row.otp_expires_at || new Date(row.otp_expires_at) < new Date()) {
    await admin.from("manager_verification_requests").update({ status: "expired", attempts_count: attempts }).eq("id", row.id);
    return jsonError("expired", 400, "Kod je istekao. Pošalji novi.");
  }
  if (attempts > MAX_ATTEMPTS) {
    await admin.from("manager_verification_requests").update({ status: "expired", attempts_count: attempts }).eq("id", row.id);
    return jsonError("too_many_attempts", 429, "Previše pogrešnih pokušaja. Pošalji novi kod.");
  }

  if (!otpMatches(body.data.otp, row.otp_hash)) {
    await admin.from("manager_verification_requests").update({ attempts_count: attempts }).eq("id", row.id);
    return jsonError("invalid_otp", 400, `Pogrešan kod. Preostalo pokušaja: ${MAX_ATTEMPTS - attempts}.`);
  }

  const claim = await claimRegistry(user.id, row.registry_id);
  if (!claim.ok) return jsonError("already_claimed", 409, "Ovaj upravnik je u međuvremenu povezan sa drugim nalogom.");

  await admin
    .from("manager_verification_requests")
    .update({ status: "verified", attempts_count: attempts, otp_hash: null, reviewed_at: new Date().toISOString() })
    .eq("id", row.id);

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "manager_verified_otp",
    entity_type: "professional_manager_registry",
    entity_id: String(row.registry_id),
  });

  return NextResponse.json({ ok: true });
}
