import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, jsonError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AddressNotPreciseError, findOrCreateBuildingFromPlace } from "@/lib/buildings";
import { ADDRESS_ERROR_MESSAGES, PlacesConfigError } from "@/lib/googlePlaces";

const MIN_AGE = 15; // ZZPL čl. 16: sa navršenih 15 godina lice samo daje pristanak za usluge informacionog društva

const currentYear = new Date().getFullYear();

const schema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  birth_year: z.number().int().min(currentYear - 110).max(currentYear - MIN_AGE),
  intent: z.enum(["resident", "manager", "other"]),
  residence_role: z.enum(["owner", "tenant", "resident"]),
  place_id: z.string().min(10).max(300),
  session_token: z.string().max(64).optional(),
  entrance: z.string().trim().max(10).optional(),
  apartment_label: z.string().trim().max(20).optional(),
});

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const msg =
      field === "birth_year"
        ? `Godina rođenja nije validna (minimalno ${MIN_AGE} godina).`
        : field === "place_id"
          ? "Izaberi adresu iz liste."
          : "Proveri unete podatke.";
    return jsonError("bad_request", 400, msg);
  }
  const d = parsed.data;

  let building;
  try {
    building = await findOrCreateBuildingFromPlace({
      placeId: d.place_id,
      sessionToken: d.session_token,
      entrance: d.entrance,
      userId: user.id,
    });
  } catch (e) {
    if (e instanceof AddressNotPreciseError) {
      return jsonError("address_not_precise", 422, ADDRESS_ERROR_MESSAGES[e.message] ?? "Adresa nije precizna.");
    }
    if (e instanceof PlacesConfigError) return jsonError("places_not_configured", 503, e.message);
    console.error("[onboarding] address", e);
    return jsonError("address_error", 502, "Provera adrese nije uspela. Pokušaj ponovo.");
  }

  const admin = createSupabaseAdminClient();

  // Članstvo (neverifikovano) u zgradi na kućnoj adresi.
  const { error: memErr } = await admin.from("building_memberships").upsert(
    {
      building_id: building.buildingId,
      user_id: user.id,
      role: d.residence_role,
      apartment_label: d.apartment_label || null,
    },
    { onConflict: "building_id,user_id,role", ignoreDuplicates: false },
  );
  if (memErr) {
    console.error("[onboarding] membership", memErr.message);
    return jsonError("db_error", 500, "Čuvanje članstva nije uspelo.");
  }

  const { data: current } = await supabase
    .from("user_profiles")
    .select("user_type")
    .eq("user_id", user.id)
    .maybeSingle();

  const profilePatch: Record<string, unknown> = {
    first_name: d.first_name,
    last_name: d.last_name,
    display_name: `${d.first_name} ${d.last_name}`,
    birth_year: d.birth_year,
    home_building_id: building.buildingId,
    city: building.address.city,
    municipality: building.address.municipality,
    onboarding_completed: true,
  };
  // Tip "professional_manager" postavlja samo verifikacija; ovde samo stanar/ostalo.
  if (current?.user_type !== "professional_manager") {
    profilePatch.user_type = d.intent === "other" ? "other" : "resident";
  }

  const { data: updated, error } = await supabase
    .from("user_profiles")
    .update(profilePatch)
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();
  if (error) {
    console.error("[onboarding] profile", error.message);
    return jsonError("db_error", 500, "Čuvanje profila nije uspelo.");
  }
  if (!updated) {
    // Profil nije napravljen pri prijavi (npr. greška u sinhronizaciji) — napravi ga sada.
    const { error: insErr } = await admin
      .from("user_profiles")
      .upsert({ user_id: user.id, user_type: "resident", ...profilePatch }, { onConflict: "user_id" });
    if (insErr) return jsonError("db_error", 500, "Čuvanje profila nije uspelo.");
  }

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "onboarding_complete",
    entity_type: "buildings",
    entity_id: building.buildingId,
    metadata: { building_created: building.created, intent: d.intent },
  });

  return NextResponse.json({
    ok: true,
    building_id: building.buildingId,
    building_created: building.created,
    next: d.intent === "manager" ? "/manager/verifikacija" : `/zgrade/${building.buildingId}`,
  });
}
