import { NextResponse, after } from "next/server";
import { z } from "zod";
import { formatAddress, getSessionUser, jsonError, rateLimit, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstileToken } from "@/lib/captcha";
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
    title: z.string().trim().max(120).optional(),
    content: z.string().trim().max(4000).optional(),
    is_anonymous_publicly: z.boolean().optional(),
    captcha_token: z.string().optional().nullable(),
  })
  .refine((d) => Boolean(d.manager_user_id) !== Boolean(d.registry_id), { message: "exactly_one_target" });

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited =
    (await rateLimit(supabase, "review_create", 5, 3600)) ?? (await rateLimit(supabase, "review_create_day", 12, 86_400));
  if (limited) return limited;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);
  const d = body.data;

  const captcha = await verifyTurnstileToken({ token: d.captcha_token });
  if (!captcha.ok) return jsonError("captcha_failed", 400, "Potvrdi da nisi robot.");

  // Anti-spam: Google nalog sa telefonom ILI potvrđeni stanar neke zgrade.
  const [{ data: profile }, { count: verifiedMemberships }] = await Promise.all([
    supabase.from("user_profiles").select("google_phone_normalized").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("building_memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("verification_status", "verified"),
  ]);
  if (!profile?.google_phone_normalized?.trim() && !verifiedMemberships) {
    return jsonError(
      "review_not_allowed",
      403,
      "Recenzije ostavljaju potvrđeni stanari. Pošalji dokaz stanovanja na stranici svoje zgrade (ili se prijavi Google nalogom koji ima broj telefona).",
    );
  }

  const admin = createSupabaseAdminClient();

  // Ako je upravnik iz registra preuzeo nalog, recenzija ide na nalog.
  let managerUserId = d.manager_user_id ?? null;
  const registryId = d.registry_id ?? null;
  if (registryId) {
    const { data: owner } = await admin.from("user_profiles").select("user_id").eq("registry_id", registryId).maybeSingle();
    if (owner?.user_id) managerUserId = owner.user_id;
  }
  if (managerUserId === user.id) return jsonError("self_review", 400, "Ne možeš oceniti sebe.");

  const { error } = await supabase.from("manager_reviews").insert({
    manager_user_id: managerUserId,
    registry_id: managerUserId ? null : registryId,
    building_id: d.building_id ?? null,
    reviewer_user_id: user.id,
    rating_overall: d.rating_overall,
    rating_transparency: d.rating_transparency ?? null,
    rating_communication: d.rating_communication ?? null,
    rating_responsiveness: d.rating_responsiveness ?? null,
    rating_price_quality: d.rating_price_quality ?? null,
    title: d.title || null,
    content: d.content || null,
    status: "pending",
    is_anonymous_publicly: d.is_anonymous_publicly ?? false,
  });

  if (error) {
    if (error.code === "23505") return jsonError("duplicate", 409, "Već si ocenio ovog upravnika za ovu zgradu.");
    if (error.code === "42501") {
      return jsonError("not_eligible", 403, "Za recenziju vezanu za zgradu moraš biti potvrđen stanar te zgrade.");
    }
    return jsonError("db_error", 500);
  }

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "review_create",
    entity_type: "manager_reviews",
    entity_id: managerUserId ?? `registry:${registryId}`,
    metadata: { manager_user_id: managerUserId, registry_id: registryId, building_id: d.building_id ?? null },
  });

  if (managerUserId) {
    const target = managerUserId;
    after(async () => {
      const [{ data: u }, { data: reviewer }, { data: building }] = await Promise.all([
        admin.auth.admin.getUserById(target),
        admin.from("user_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        d.building_id
          ? admin.from("buildings").select("street, street_number, entrance, city").eq("id", d.building_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!u?.user?.email) return;
      await sendReviewNotification({
        managerEmail: u.user.email,
        reviewerName: d.is_anonymous_publicly ? "Anonimni stanar" : reviewer?.display_name ?? "Stanar",
        ratingOverall: d.rating_overall,
        buildingAddress: formatAddress(building),
        reviewUrl: `${siteUrl()}/manager/recenzije`,
      }).catch(() => undefined);
    });
  }

  return NextResponse.json({ ok: true });
}
