import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  review_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "review_reply_upsert", limit: 200, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("review_replies")
    .upsert(
      {
        review_id: body.data.review_id,
        manager_user_id: user.id,
        content: body.data.content,
        status: "published",
      },
      { onConflict: "review_id" },
    )
    .select("id, review_id, manager_user_id, content, status, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "review_reply_upsert",
    entity_type: "review_replies",
    entity_id: row.id,
    metadata: { review_id: body.data.review_id },
  });

  return NextResponse.json({ row });
}

