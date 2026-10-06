import { NextResponse, after } from "next/server";
import { formatAddress, getSessionUser, jsonError, rateLimit, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendMembershipRequestNotification } from "@/lib/email";
import { storePrivateFile, validateUpload } from "@/lib/uploads";

/** Stanar šalje dokaz stanovanja (ugovor, vlasnički list, račun za struju/infostan). */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited = await rateLimit(supabase, "membership_proof", 10, 3600);
  if (limited) return limited;

  const formData = await request.formData();
  const buildingId = String(formData.get("building_id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const upload = validateUpload(formData.get("file"), 10);
  if (!upload.ok) return jsonError("bad_file", 400, upload.error);

  const { data: membership } = await supabase
    .from("building_memberships")
    .select("id, verification_status")
    .eq("building_id", buildingId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return jsonError("not_member", 403, "Nisi član ove zgrade.");
  if (membership.verification_status === "verified") return jsonError("already_verified", 400, "Članstvo je već potvrđeno.");

  let path: string;
  try {
    path = await storePrivateFile(`membership-proofs/${buildingId}/${user.id}`, upload.file, upload.ext);
  } catch {
    return jsonError("upload_failed", 500, "Upload nije uspeo.");
  }

  // Status menja server (korisnik ne može sam sebi da menja verifikaciju).
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("building_memberships")
    .update({
      proof_document_path: path,
      proof_uploaded_at: new Date().toISOString(),
      proof_note: note || null,
      verification_status: "pending",
      verification_method: "document",
    })
    .eq("id", membership.id);
  if (error) return jsonError("db_error", 500);

  after(async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    const [{ data: building }, { data: profile }] = await Promise.all([
      admin.from("buildings").select("street, street_number, entrance, city").eq("id", buildingId).maybeSingle(),
      admin.from("user_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    ]);
    await sendMembershipRequestNotification({
      adminEmail,
      userName: profile?.display_name ?? user.email ?? "Korisnik",
      buildingAddress: formatAddress(building),
      role: "stanar (dokaz priložen)",
      adminUrl: `${siteUrl()}/admin/clanstva`,
    }).catch(() => undefined);
  });

  return NextResponse.json({ ok: true });
}
