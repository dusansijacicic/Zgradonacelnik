import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { sendReviewNotification } from "@/lib/email";

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

  await enforceRateLimit({ action: "review_create", limit: 5, windowSeconds: 3600 });
  await enforceRateLimit({ action: "review_create_day", limit: 12, windowSeconds: 86_400 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { verifyTurnstileToken } = await import("@/lib/captcha");
  const captcha = await verifyTurnstileToken({ token: body.data.captcha_token });
  if (!captcha.ok) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
  }

  const { data: reviewerProfile } = await supabase
    .from("user_profiles")
    .select("google_phone_normalized")
    .eq("user_id", user.id)
    .maybeSingle();

  const phoneOk = Boolean(reviewerProfile?.google_phone_normalized?.trim());
  if (!phoneOk) {
    return NextResponse.json(
      {
        error: "review_requires_google_phone",
        detail:
          "Recenzije su dozvoljene samo nakon prijave sa Google naloga koji deli broj telefona (People API). Ponovo se prijavi i prihvati pristup telefonu i adresi.",
      },
      { status: 403 },
    );
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

  // Email notifikacija manageru (fire-and-forget)
  if (body.data.manager_user_id) {
    void (async () => {
      try {
        const [reviewerProf, managerAuth, building] = await Promise.all([
          supabase.from("user_profiles").select("display_name, first_name, last_name").eq("user_id", user.id).maybeSingle(),
          supabase.from("user_profiles").select("display_name").eq("user_id", body.data.manager_user_id!).maybeSingle(),
          body.data.building_id
            ? supabase.from("buildings").select("street, street_number, city").eq("id", body.data.building_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const managerEmail = (await supabase.auth.admin?.getUserById?.(body.data.manager_user_id!))?.data?.user?.email;
        // Fallback: use admin client to get email
        const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
        const adminSb = createSupabaseAdminClient();
        const { data: managerUser } = await adminSb.auth.admin.getUserById(body.data.manager_user_id!);
        if (managerUser?.user?.email) {
          const reviewerName = body.data.is_anonymous_publicly
            ? "Anonimni korisnik"
            : (reviewerProf.data?.display_name || [reviewerProf.data?.first_name, reviewerProf.data?.last_name].filter(Boolean).join(" ") || "Korisnik");
          const buildingAddr = building.data
            ? `${building.data.street} ${building.data.street_number}, ${building.data.city}`
            : "";
          await sendReviewNotification({
            managerEmail: managerUser.user.email,
            managerName: managerAuth.data?.display_name ?? "Upravnik",
            reviewerName,
            ratingOverall: body.data.rating_overall,
            buildingAddress: buildingAddr,
            reviewUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/manager/recenzije`,
          });
        }
      } catch { /* ne blokiramo odgovor zbog email greške */ }
    })();
  }

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

