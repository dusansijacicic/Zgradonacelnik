import { NextResponse, after } from "next/server";
import { z } from "zod";
import { formatAddress, getSessionUser, jsonError, rateLimit, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AddressNotPreciseError, findOrCreateBuildingFromPlace } from "@/lib/buildings";
import { ADDRESS_ERROR_MESSAGES, PlacesConfigError } from "@/lib/googlePlaces";
import { storeBuildingDocument, validateUpload } from "@/lib/uploads";
import { sendEmail } from "@/lib/email";

const fieldsSchema = z.object({
  building_id: z.string().uuid().optional(),
  place_id: z.string().min(10).max(300).optional(),
  session_token: z.string().max(64).optional(),
  entrance: z.string().trim().max(10).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Verifikovani upravnik unosi zgradu koju održava: adresa (Google) + dokaz ovlašćenja
 * (ugovor / odluka skupštine). Veza je "pending" dok je admin ne odobri.
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type, professional_manager_status, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.user_type !== "professional_manager" || profile.professional_manager_status !== "verified") {
    return jsonError("not_verified_manager", 403, "Prvo potvrdi da si upravnik iz registra.");
  }

  const limited = await rateLimit(supabase, "assignment_request", 30, 3600);
  if (limited) return limited;

  const form = await request.formData();
  const fields = fieldsSchema.safeParse({
    building_id: form.get("building_id") || undefined,
    place_id: form.get("place_id") || undefined,
    session_token: form.get("session_token") || undefined,
    entrance: form.get("entrance") || undefined,
    start_date: form.get("start_date") || undefined,
  });
  if (!fields.success || (!fields.data.place_id && !fields.data.building_id)) {
    return jsonError("bad_request", 400, "Izaberi adresu iz liste.");
  }

  const upload = validateUpload(form.get("proof"));
  if (!upload.ok) return jsonError("bad_file", 400, `Dokaz ovlašćenja: ${upload.error}`);

  const admin = createSupabaseAdminClient();

  // Postojeća zgrada (sa stranice zgrade) ili nova adresa preko Google-a.
  let building: { buildingId: string; created: boolean; addressText: string };
  if (fields.data.building_id) {
    const { data: b } = await admin
      .from("buildings")
      .select("id, street, street_number, entrance, city")
      .eq("id", fields.data.building_id)
      .maybeSingle();
    if (!b) return jsonError("not_found", 404);
    building = { buildingId: b.id, created: false, addressText: formatAddress(b) };
  } else {
    try {
      const r = await findOrCreateBuildingFromPlace({
        placeId: fields.data.place_id!,
        sessionToken: fields.data.session_token,
        entrance: fields.data.entrance,
        userId: user.id,
      });
      building = {
        buildingId: r.buildingId,
        created: r.created,
        addressText: formatAddress({
          street: r.address.street,
          street_number: r.address.streetNumber,
          entrance: fields.data.entrance,
          city: r.address.city,
        }),
      };
    } catch (e) {
      if (e instanceof AddressNotPreciseError) return jsonError("address_not_precise", 422, ADDRESS_ERROR_MESSAGES[e.message]);
      if (e instanceof PlacesConfigError) return jsonError("places_not_configured", 503, e.message);
      return jsonError("address_error", 502, "Provera adrese nije uspela.");
    }
  }
  const { data: existing } = await admin
    .from("building_manager_assignments")
    .select("id, status")
    .eq("building_id", building.buildingId)
    .eq("manager_user_id", user.id)
    .in("status", ["pending", "active"])
    .maybeSingle();
  if (existing) {
    return jsonError(
      "duplicate",
      409,
      existing.status === "active" ? "Već si aktivni upravnik ove zgrade." : "Zahtev za ovu zgradu već čeka odobrenje.",
    );
  }

  let proofId: string;
  try {
    proofId = await storeBuildingDocument({
      userId: user.id,
      buildingId: building.buildingId,
      file: upload.file,
      ext: upload.ext,
      documentType: "contract",
      visibility: "private",
      title: "Dokaz ovlašćenja upravnika",
    });
  } catch (e) {
    console.error("[manager/buildings] upload", e);
    return jsonError("upload_failed", 500, "Upload dokaza nije uspeo.");
  }

  const { data: row, error } = await supabase
    .from("building_manager_assignments")
    .insert({
      building_id: building.buildingId,
      manager_user_id: user.id,
      status: "pending",
      start_date: fields.data.start_date ?? null,
      proof_document_id: proofId,
      requested_by: user.id,
      source: "manager",
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("[manager/buildings] insert", error?.message);
    return jsonError("db_error", 500);
  }

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "assignment_request",
    entity_type: "building_manager_assignments",
    entity_id: row.id,
    metadata: { building_id: building.buildingId, building_created: building.created },
  });

  after(async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    await sendEmail({
      to: adminEmail,
      subject: `Upravnik traži zgradu — ${building.addressText}`,
      html: `<p>${profile.display_name ?? "Upravnik"} traži potvrdu da upravlja zgradom
        <strong>${building.addressText}</strong>.</p>
        <p><a href="${siteUrl()}/admin/zgrade-upravnici">Pregledaj dokaz i odobri →</a></p>`,
    }).catch(() => undefined);
  });

  return NextResponse.json({ ok: true, building_id: building.buildingId, assignment_id: row.id });
}
