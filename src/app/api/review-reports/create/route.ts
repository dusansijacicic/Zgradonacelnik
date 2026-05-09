import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  review_id: z.string().uuid(),
  reason: z.string().min(3).max(120),
  details: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "review_report_create", limit: 20, windowSeconds: 86400 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("review_reports")
    .insert({
      review_id: body.data.review_id,
      reported_by: user.id,
      reason: body.data.reason,
      details: body.data.details ?? null,
      status: "open",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "review_report_create",
    entity_type: "review_reports",
    entity_id: row.id,
    metadata: { review_id: body.data.review_id },
  });

  return NextResponse.json({ ok: true });
}

