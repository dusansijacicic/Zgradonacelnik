import { NextResponse, after } from "next/server";
import { z } from "zod";
import { formatAddress, getSessionUser, jsonError, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/uploads";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

/**
 * Potvrda stanara: admin ili AKTIVNI upravnik te zgrade.
 * Autorizaciju sprovodi RLS + trigger (upravnik sme da menja verification_status samo u svojoj zgradi).
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);

  const { data: updated, error } = await supabase
    .from("building_memberships")
    .update({
      verification_status: body.data.action === "approve" ? "verified" : "rejected",
      verification_method: "admin",
    })
    .eq("id", body.data.id)
    .neq("user_id", user.id)
    .select("id, user_id, building_id")
    .maybeSingle();

  if (error || !updated) return jsonError("forbidden", 403, "Nemaš pravo da potvrdiš ovog člana.");

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: `membership_${body.data.action}`,
    entity_type: "building_memberships",
    entity_id: updated.id,
    metadata: { building_id: updated.building_id },
  });

  after(async () => {
    const admin = createSupabaseAdminClient();
    const [{ data: u }, { data: b }] = await Promise.all([
      admin.auth.admin.getUserById(updated.user_id),
      admin.from("buildings").select("street, street_number, entrance, city").eq("id", updated.building_id).maybeSingle(),
    ]);
    if (!u?.user?.email) return;
    const ok = body.data.action === "approve";
    await sendEmail({
      to: u.user.email,
      subject: ok ? "Članstvo u zgradi je potvrđeno" : "Članstvo u zgradi nije potvrđeno",
      html: ok
        ? `<p>Potvrđeno je da stanuješ u zgradi <strong>${formatAddress(b)}</strong>. Sada možeš da glasaš, predlažeš radove i ocenjuješ upravnika.</p>
           <p><a href="${siteUrl()}/zgrade/${updated.building_id}">Otvori zgradu →</a></p>`
        : `<p>Dokaz za zgradu <strong>${formatAddress(b)}</strong> nije prihvaćen. Možeš poslati novi dokaz (ugovor, vlasnički list, račun na tvoje ime za tu adresu).</p>
           <p><a href="${siteUrl()}/zgrade/${updated.building_id}">Pošalji novi dokaz →</a></p>`,
    }).catch(() => undefined);
  });

  return NextResponse.json({ ok: true });
}

/** Signed URL za dokaz stanovanja (10 min) — vidi ga samo admin ili aktivni upravnik zgrade. */
export async function GET(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("bad_request", 400);

  const { data: m } = await supabase
    .from("building_memberships")
    .select("id, user_id, building_id, proof_document_path")
    .eq("id", id)
    .maybeSingle();
  if (!m?.proof_document_path) return jsonError("not_found", 404);

  // RLS vraća red i samom članu — ali dokaz smeju da otvore samo admin / upravnik (i vlasnik dokaza).
  const [{ data: isMgr }, { data: prof }] = await Promise.all([
    supabase.rpc("is_active_manager", { building: m.building_id }),
    supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!isMgr && !prof?.is_admin && m.user_id !== user.id) return jsonError("forbidden", 403);

  const admin = createSupabaseAdminClient();
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(m.proof_document_path, 600);
  if (!signed?.signedUrl) return jsonError("sign_failed", 500);
  return NextResponse.json({ url: signed.signedUrl });
}
