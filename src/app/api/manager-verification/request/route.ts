import { NextResponse } from "next/server";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { getSessionUser, jsonError, rateLimit } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendEmail } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/captcha";
import { claimRegistry, findRegistryByEmail } from "@/lib/registryClaim";

const bodySchema = z.object({
  email: z.string().trim().email().max(200),
  registry_id: z.number().int().positive().optional(),
  captcha_token: z.string().optional().nullable(),
});

/**
 * Upravnik se registruje SAMO email adresom koja postoji u (aktivnom) PKS registru.
 * - Ako je to baš email kojim je prijavljen (Google/magic link ga je već potvrdio) → odmah verifikovan.
 * - Inače šaljemo OTP na email iz registra.
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited = await rateLimit(supabase, "otp_send", 5, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400, "Unesi ispravnu email adresu.");

  const captcha = await verifyTurnstileToken({ token: body.data.captcha_token });
  if (!captcha.ok) return jsonError("captcha_failed", 400, "Potvrdi da nisi robot.");

  const email = body.data.email.toLowerCase();
  const { candidates, inactiveOnly } = await findRegistryByEmail(email);

  if (!candidates.length) {
    return jsonError(
      inactiveOnly ? "registry_inactive" : "not_in_registry",
      404,
      inactiveOnly
        ? "Ovaj email pripada upravniku koji je obrisan iz registra PKS. Registracija nije moguća."
        : "Ovaj email nije u registru profesionalnih upravnika (PKS). Upravnici se registruju isključivo email adresom iz registra.",
    );
  }

  let candidate = candidates[0];
  if (candidates.length > 1) {
    const picked = candidates.find((c) => c.id === body.data.registry_id);
    if (!picked) {
      return NextResponse.json(
        {
          error: "choose_registry_entry",
          detail: "Ovaj email je u registru vezan za više upravnika. Izaberi koji si ti.",
          candidates: candidates.map(({ claimed_by, ...c }) => ({ ...c, claimed: Boolean(claimed_by) })),
        },
        { status: 409 },
      );
    }
    candidate = picked;
  }

  if (candidate.claimed_by && candidate.claimed_by !== user.id) {
    return jsonError(
      "already_claimed",
      409,
      "Ovaj upravnik iz registra je već povezan sa drugim nalogom. Ako je to greška, javi se na kontakt stranici.",
    );
  }
  if (candidate.claimed_by === user.id) return NextResponse.json({ status: "verified" });

  const admin = createSupabaseAdminClient();

  // Email kojim je korisnik prijavljen je već dokazan (Google / magic link) → nema potrebe za OTP.
  const loginEmail = user.email?.trim().toLowerCase();
  if (loginEmail && loginEmail === email && user.email_confirmed_at) {
    const claim = await claimRegistry(user.id, candidate.id);
    if (!claim.ok) return jsonError("already_claimed", 409, "Ovaj upravnik je već povezan sa drugim nalogom.");
    await admin.from("manager_verification_requests").insert({
      user_id: user.id,
      registry_id: candidate.id,
      requested_email: email,
      verification_method: "email",
      status: "verified",
      reviewed_at: new Date().toISOString(),
    });
    await supabase.from("audit_log").insert({
      actor_user_id: user.id,
      action: "manager_verified_login_email",
      entity_type: "professional_manager_registry",
      entity_id: String(candidate.id),
    });
    return NextResponse.json({ status: "verified" });
  }

  // Poništi prethodne otvorene zahteve ovog korisnika.
  await admin
    .from("manager_verification_requests")
    .update({ status: "expired" })
    .eq("user_id", user.id)
    .eq("status", "pending");

  const otp = generateOtp();
  const { data: reqRow, error: reqErr } = await admin
    .from("manager_verification_requests")
    .insert({
      user_id: user.id,
      registry_id: candidate.id,
      requested_email: email,
      verification_method: "email",
      status: "pending",
      otp_hash: hashOtp(otp),
      otp_expires_at: addMinutes(new Date(), 15).toISOString(),
      attempts_count: 0,
    })
    .select("id")
    .single();
  if (reqErr || !reqRow) return jsonError("db_error", 500);

  await sendEmail({
    to: email,
    subject: "Zgradonačelnik.rs — kod za potvrdu upravnika",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#18181b;line-height:1.5">
        <h2 style="font-size:20px">Kod za potvrdu</h2>
        <p>Neko (verovatno Vi) potvrđuje da je profesionalni upravnik <strong>${candidate.full_name}</strong> na platformi Zgradonačelnik.rs.</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>
        <p style="color:#71717a;font-size:13px">Kod važi 15 minuta. Ako niste Vi pokrenuli potvrdu, ignorišite ovu poruku.</p>
      </div>`,
  });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "otp_send",
    entity_type: "manager_verification_requests",
    entity_id: reqRow.id,
    metadata: { registry_id: candidate.id },
  });

  return NextResponse.json({ status: "otp_sent", id: reqRow.id, full_name: candidate.full_name });
}
