import { NextResponse, after } from "next/server";
import { z } from "zod";
import { formatAddress, getSessionUser, isAdmin, jsonError, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "end"]),
});

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  if (!(await isAdmin(supabase, user.id))) return jsonError("forbidden", 403);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);

  const { data: row } = await supabase
    .from("building_manager_assignments")
    .select("id, building_id, manager_user_id, registry_id, status")
    .eq("id", body.data.id)
    .maybeSingle();
  if (!row) return jsonError("not_found", 404);

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  if (body.data.action === "approve") {
    // Zgrada ima jednog aktivnog upravnika: prethodni prelazi u istoriju (recenzije ostaju).
    await supabase
      .from("building_manager_assignments")
      .update({ status: "ended", end_date: today })
      .eq("building_id", row.building_id)
      .eq("status", "active")
      .neq("id", row.id);
  }

  const patch =
    body.data.action === "approve"
      ? { status: "active", approved_by: user.id, approved_at: now }
      : body.data.action === "reject"
        ? { status: "rejected", approved_by: user.id, approved_at: now }
        : { status: "ended", end_date: today };

  const { error } = await supabase.from("building_manager_assignments").update(patch).eq("id", row.id);
  if (error) return jsonError("db_error", 500);

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: `assignment_${body.data.action}`,
    entity_type: "building_manager_assignments",
    entity_id: row.id,
    metadata: { building_id: row.building_id },
  });

  if (row.manager_user_id && body.data.action !== "end") {
    const managerId = row.manager_user_id;
    after(async () => {
      const admin = createSupabaseAdminClient();
      const [{ data: u }, { data: b }] = await Promise.all([
        admin.auth.admin.getUserById(managerId),
        admin.from("buildings").select("street, street_number, entrance, city").eq("id", row.building_id).maybeSingle(),
      ]);
      if (!u?.user?.email) return;
      const ok = body.data.action === "approve";
      await sendEmail({
        to: u.user.email,
        subject: ok ? `Potvrđeno: upravljaš zgradom ${formatAddress(b)}` : `Zahtev za zgradu ${formatAddress(b)} nije odobren`,
        html: ok
          ? `<p>Zgrada <strong>${formatAddress(b)}</strong> je dodata u tvoj profil. Sada možeš da potvrđuješ stanare i aktiviraš Premium.</p>
             <p><a href="${siteUrl()}/zgrade/${row.building_id}">Otvori zgradu →</a></p>`
          : `<p>Dokaz za zgradu <strong>${formatAddress(b)}</strong> nije prihvaćen. Pošalji ugovor ili odluku skupštine na kojoj se vidi tvoje postavljenje.</p>`,
      }).catch(() => undefined);
    });
  }

  return NextResponse.json({ ok: true });
}
