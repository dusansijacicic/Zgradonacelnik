import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(8000),
  visibility: z.enum(["residents_only", "public"]).optional(),
  pinned: z.boolean().optional(),
  captcha_token: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "announcement_create", limit: 30, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { verifyTurnstileToken } = await import("@/lib/captcha");
  const captcha = await verifyTurnstileToken({ token: body.data.captcha_token });
  if (!captcha.ok) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("building_announcements")
    .insert({
      building_id: body.data.building_id,
      created_by: user.id,
      title: body.data.title,
      content: body.data.content,
      visibility: body.data.visibility ?? "residents_only",
      pinned: body.data.pinned ?? false,
    })
    .select("id, title, content, pinned, visibility, created_at")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "announcement_create",
    entity_type: "building_announcements",
    entity_id: row.id,
    metadata: { building_id: body.data.building_id },
  });

  return NextResponse.json({ row });
}

