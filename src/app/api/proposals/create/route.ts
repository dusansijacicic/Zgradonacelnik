import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(8000),
  category: z.enum([
    "repair",
    "cleaning",
    "security",
    "maintenance",
    "finance",
    "other",
  ]),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  captcha_token: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "proposal_create", limit: 50, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { verifyTurnstileToken } = await import("@/lib/captcha");
  const captcha = await verifyTurnstileToken({ token: body.data.captcha_token });
  if (!captcha.ok) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("building_proposals")
    .insert({
      building_id: body.data.building_id,
      created_by: user.id,
      title: body.data.title,
      description: body.data.description,
      category: body.data.category,
      priority: body.data.priority ?? "medium",
    })
    .select(
      "id, title, description, category, status, priority, estimated_cost, created_at",
    )
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "proposal_create",
    entity_type: "building_proposals",
    entity_id: row.id,
    metadata: { building_id: body.data.building_id },
  });

  return NextResponse.json({ row });
}

