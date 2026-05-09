import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  proposal_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
  captcha_token: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "proposal_comment_create", limit: 200, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { verifyTurnstileToken } = await import("@/lib/captcha");
  const captcha = await verifyTurnstileToken({ token: body.data.captcha_token });
  if (!captcha.ok) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("proposal_comments")
    .insert({
      proposal_id: body.data.proposal_id,
      user_id: user.id,
      content: body.data.content,
    })
    .select("id, content, user_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "proposal_comment_create",
    entity_type: "proposal_comments",
    entity_id: row.id,
    metadata: { proposal_id: body.data.proposal_id },
  });

  return NextResponse.json({ row });
}

