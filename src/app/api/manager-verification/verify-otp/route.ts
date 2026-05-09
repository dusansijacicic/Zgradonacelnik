import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashOtp } from "@/lib/otp";

const bodySchema = z.object({
  request_id: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("manager_verification_requests")
    .select("id, user_id, status, otp_hash, otp_expires_at, attempts_count")
    .eq("id", body.data.request_id)
    .single();

  if (error || !row || row.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const attempts = (row.attempts_count ?? 0) + 1;
  const now = new Date();
  const expiresAt = row.otp_expires_at ? new Date(row.otp_expires_at) : null;

  if (!expiresAt || expiresAt < now) {
    await supabase
      .from("manager_verification_requests")
      .update({ status: "expired", attempts_count: attempts })
      .eq("id", row.id);
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }

  if (attempts > 8) {
    await supabase
      .from("manager_verification_requests")
      .update({ status: "needs_manual_review", attempts_count: attempts })
      .eq("id", row.id);
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  if (hashOtp(body.data.otp) !== row.otp_hash) {
    await supabase
      .from("manager_verification_requests")
      .update({ attempts_count: attempts })
      .eq("id", row.id);
    return NextResponse.json({ error: "invalid_otp" }, { status: 400 });
  }

  // OTP ok -> mark verified (admin can still override later)
  await supabase
    .from("manager_verification_requests")
    .update({ status: "verified", attempts_count: attempts, reviewed_at: new Date().toISOString() })
    .eq("id", row.id);

  await supabase
    .from("user_profiles")
    .update({ user_type: "professional_manager", professional_manager_status: "verified" })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

