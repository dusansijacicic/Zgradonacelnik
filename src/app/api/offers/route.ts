import { NextResponse, after } from "next/server";
import { z } from "zod";
import { formatAddress, getSessionUser, jsonError, rateLimit, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const createSchema = z.object({
  building_id: z.string().uuid(),
  message: z.string().trim().min(10).max(2000),
  price_monthly_rsd: z.number().int().min(0).max(10_000_000).nullable().optional(),
  contact_phone: z.string().trim().max(40).optional(),
});

/** Verifikovani upravnik nudi upravljanje zgradi — vide je članovi te zgrade. */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited = await rateLimit(supabase, "offer_create", 30, 86_400);
  if (limited) return limited;

  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400, "Poruka mora imati bar 10 karaktera.");

  const { data: activeAssignment } = await supabase
    .from("building_manager_assignments")
    .select("id")
    .eq("building_id", body.data.building_id)
    .eq("manager_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (activeAssignment) return jsonError("already_manager", 400, "Već upravljaš ovom zgradom.");

  const { data: row, error } = await supabase
    .from("manager_offers")
    .insert({
      building_id: body.data.building_id,
      manager_user_id: user.id,
      message: body.data.message,
      price_monthly_rsd: body.data.price_monthly_rsd ?? null,
      contact_email: user.email ?? null,
      contact_phone: body.data.contact_phone || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return jsonError("duplicate", 409, "Već imaš otvorenu ponudu za ovu zgradu.");
    if (error.code === "42501") return jsonError("not_verified_manager", 403, "Ponude šalju samo verifikovani upravnici.");
    return jsonError("db_error", 500);
  }

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "offer_create",
    entity_type: "manager_offers",
    entity_id: row.id,
    metadata: { building_id: body.data.building_id },
  });

  // Obavesti članove zgrade (najviše 100) — transakciona poruka o njihovoj zgradi.
  after(async () => {
    const admin = createSupabaseAdminClient();
    const [{ data: building }, { data: members }, { data: manager }] = await Promise.all([
      admin.from("buildings").select("street, street_number, entrance, city").eq("id", body.data.building_id).maybeSingle(),
      admin.from("building_memberships").select("user_id").eq("building_id", body.data.building_id).limit(100),
      admin.from("manager_public_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    ]);
    const address = formatAddress(building);
    for (const m of members ?? []) {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id);
      if (!u?.user?.email) continue;
      await sendEmail({
        to: u.user.email,
        subject: `Nova ponuda upravnika za ${address}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#18181b">
            <p>Profesionalni upravnik <strong>${manager?.display_name ?? "iz registra PKS"}</strong> ponudio je upravljanje zgradom
            <strong>${address}</strong>.</p>
            <a href="${siteUrl()}/zgrade/${body.data.building_id}">Pogledaj ponudu i ocene upravnika →</a>
          </div>`,
      }).catch(() => undefined);
    }
  });

  return NextResponse.json({ id: row.id });
}

const withdrawSchema = z.object({ id: z.string().uuid() });

export async function PATCH(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  const body = withdrawSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);

  const { error } = await supabase
    .from("manager_offers")
    .update({ status: "withdrawn" })
    .eq("id", body.data.id)
    .eq("manager_user_id", user.id);
  if (error) return jsonError("db_error", 500);
  return NextResponse.json({ ok: true });
}
