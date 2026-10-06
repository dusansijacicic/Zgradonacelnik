import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getSessionUser, jsonError, rateLimit, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  registry_id: z.coerce.number().int().positive(),
});

/**
 * Stanar povezuje upravnika iz PKS registra sa svojom zgradom ("naš upravnik je X").
 * Veza je pending dok je admin ne potvrdi; upravnik (ako ima nalog) je vidi u svom panelu.
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited = await rateLimit(supabase, "registry_assignment_suggest", 10, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);
  const { building_id, registry_id } = body.data;

  const { data: membership } = await supabase
    .from("building_memberships")
    .select("id")
    .eq("building_id", building_id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return jsonError("not_member", 403, "Upravnika može povezati samo član zgrade.");

  const admin = createSupabaseAdminClient();
  const [{ data: reg }, { data: owner }] = await Promise.all([
    admin.from("professional_manager_registry").select("id, full_name, is_active").eq("id", registry_id).maybeSingle(),
    admin.from("user_profiles").select("user_id").eq("registry_id", registry_id).maybeSingle(),
  ]);
  if (!reg) return jsonError("registry_not_found", 404, "Upravnik nije pronađen u registru.");
  if (!reg.is_active) return jsonError("registry_inactive", 400, "Ovaj upravnik je obrisan iz registra PKS.");

  const { data: existing } = await admin
    .from("building_manager_assignments")
    .select("id, status, registry_id, manager_user_id")
    .eq("building_id", building_id)
    .in("status", ["pending", "active"]);
  const dup = (existing ?? []).find(
    (a) => a.registry_id === registry_id || (owner?.user_id && a.manager_user_id === owner.user_id),
  );
  if (dup) {
    return jsonError(
      "duplicate",
      409,
      dup.status === "active" ? "Ovaj upravnik je već potvrđen za zgradu." : "Ovaj predlog već čeka potvrdu.",
    );
  }

  const { data: row, error } = await admin
    .from("building_manager_assignments")
    .insert({
      building_id,
      registry_id,
      manager_user_id: owner?.user_id ?? null,
      status: "pending",
      requested_by: user.id,
      source: "resident",
    })
    .select("id")
    .single();
  if (error || !row) return jsonError("db_error", 500);

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "registry_assignment_suggest",
    entity_type: "building_manager_assignments",
    entity_id: row.id,
    metadata: { building_id, registry_id },
  });

  after(async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    await sendEmail({
      to: adminEmail,
      subject: `Stanar povezao upravnika: ${reg.full_name}`,
      html: `<p>Stanar je naveo <strong>${reg.full_name}</strong> kao upravnika zgrade.</p>
        <p><a href="${siteUrl()}/admin/zgrade-upravnici">Pregledaj →</a></p>`,
    }).catch(() => undefined);
  });

  return NextResponse.json({ id: row.id, status: "pending" });
}
