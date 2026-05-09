import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z
  .object({
    manager_user_id: z.string().uuid().optional(),
    registry_id: z.coerce.number().int().positive().optional(),
    building_id: z.string().uuid().optional(),
    rating_overall: z.number().int().min(1).max(5),
    rating_transparency: z.number().int().min(1).max(5).optional(),
    rating_communication: z.number().int().min(1).max(5).optional(),
    rating_responsiveness: z.number().int().min(1).max(5).optional(),
    rating_price_quality: z.number().int().min(1).max(5).optional(),
    title: z.string().max(120).optional(),
    content: z.string().max(4000).optional(),
    is_anonymous_publicly: z.boolean().optional(),
    captcha_token: z.string().optional(),
  })
  .refine((d) => Boolean(d.manager_user_id) !== Boolean(d.registry_id), {
    message: "exactly_one_target",
  });

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "review_create", limit: 10, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { verifyTurnstileToken } = await import("@/lib/captcha");
  const captcha = await verifyTurnstileToken({ token: body.data.captcha_token });
  if (!captcha.ok) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
  }

  const insertRow = {
    manager_user_id: body.data.manager_user_id ?? null,
    registry_id: body.data.registry_id ?? null,
    building_id: body.data.building_id ?? null,
    reviewer_user_id: user.id,
    rating_overall: body.data.rating_overall,
    rating_transparency: body.data.rating_transparency ?? null,
    rating_communication: body.data.rating_communication ?? null,
    rating_responsiveness: body.data.rating_responsiveness ?? null,
    rating_price_quality: body.data.rating_price_quality ?? null,
    title: body.data.title ?? null,
    content: body.data.content ?? null,
    status: "pending",
    is_anonymous_publicly: body.data.is_anonymous_publicly ?? false,
  };

  const { error } = await supabase.from("manager_reviews").insert(insertRow);

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "review_create",
    entity_type: "manager_reviews",
    entity_id:
      body.data.manager_user_id ?? (body.data.registry_id != null ? `registry:${body.data.registry_id}` : ""),
    metadata: {
      manager_user_id: body.data.manager_user_id ?? null,
      registry_id: body.data.registry_id ?? null,
      building_id: body.data.building_id ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

