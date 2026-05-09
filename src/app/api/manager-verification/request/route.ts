import { NextResponse } from "next/server";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  captcha_token: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "otp_send", limit: 5, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { verifyTurnstileToken } = await import("@/lib/captcha");
  const captcha = await verifyTurnstileToken({ token: body.data.captcha_token });
  if (!captcha.ok) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
  }

  // Find matching registry record by email (normalized_email in DB)
  const { data: registry } = await supabase
    .from("professional_manager_registry")
    .select("id, full_name, email")
    .ilike("normalized_email", body.data.email.toLowerCase())
    .maybeSingle();

  // If registry access is admin-only, in MVP we can't query as regular user.
  // So we fall back to manual review by creating a request without registry_id.
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = addMinutes(new Date(), 15).toISOString();

  const { data: reqRow, error: reqErr } = await supabase
    .from("manager_verification_requests")
    .insert({
      user_id: user.id,
      registry_id: registry?.id ?? null,
      requested_email: body.data.email,
      verification_method: "email",
      status: registry ? "pending" : "needs_manual_review",
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
      attempts_count: 0,
    })
    .select("id, status")
    .single();

  if (reqErr) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Send OTP even if manual review (still proves control of email)
  await sendEmail({
    to: body.data.email,
    subject: "Zgradonačelnik.rs – OTP za verifikaciju upravnika",
    html: `
      <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
        <h2>OTP kod</h2>
        <p>Vaš kod za verifikaciju je:</p>
        <p style="font-size: 24px; font-weight: 700; letter-spacing: 2px">${otp}</p>
        <p>Kod važi 15 minuta.</p>
      </div>
    `,
  });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "otp_send",
    entity_type: "manager_verification_requests",
    entity_id: reqRow.id,
    metadata: { email: body.data.email },
  });

  // Ensure user profile is marked as professional_manager (requested)
  await supabase
    .from("user_profiles")
    .update({
      user_type: "professional_manager",
      professional_manager_status: reqRow.status,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ id: reqRow.id, status: reqRow.status });
}

