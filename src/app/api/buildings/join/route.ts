import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, jsonError, rateLimit } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AddressNotPreciseError, findOrCreateBuildingFromPlace } from "@/lib/buildings";
import { ADDRESS_ERROR_MESSAGES, PlacesConfigError } from "@/lib/googlePlaces";

const schema = z
  .object({
    building_id: z.string().uuid().optional(),
    place_id: z.string().min(10).max(300).optional(),
    session_token: z.string().max(64).optional(),
    entrance: z.string().trim().max(10).optional(),
    role: z.enum(["owner", "tenant", "resident"]).default("resident"),
    apartment_label: z.string().trim().max(20).optional(),
  })
  .refine((d) => Boolean(d.building_id) !== Boolean(d.place_id), { message: "one_target" });

/** Pridruživanje zgradi (npr. drugi stan, vikendica) — članstvo je neverifikovano dok se ne potvrdi. */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited = await rateLimit(supabase, "building_join", 10, 3600);
  if (limited) return limited;

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400, "Izaberi adresu iz liste.");

  let buildingId = body.data.building_id;
  if (!buildingId) {
    try {
      const r = await findOrCreateBuildingFromPlace({
        placeId: body.data.place_id!,
        sessionToken: body.data.session_token,
        entrance: body.data.entrance,
        userId: user.id,
      });
      buildingId = r.buildingId;
    } catch (e) {
      if (e instanceof AddressNotPreciseError) return jsonError("address_not_precise", 422, ADDRESS_ERROR_MESSAGES[e.message]);
      if (e instanceof PlacesConfigError) return jsonError("places_not_configured", 503, e.message);
      return jsonError("address_error", 502, "Provera adrese nije uspela.");
    }
  }

  const admin = createSupabaseAdminClient();
  const { data: building } = await admin.from("buildings").select("id").eq("id", buildingId).maybeSingle();
  if (!building) return jsonError("not_found", 404);

  const { error } = await admin.from("building_memberships").upsert(
    {
      building_id: buildingId,
      user_id: user.id,
      role: body.data.role,
      apartment_label: body.data.apartment_label || null,
    },
    { onConflict: "building_id,user_id,role" },
  );
  if (error) return jsonError("db_error", 500);

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "building_join",
    entity_type: "buildings",
    entity_id: buildingId,
  });

  return NextResponse.json({ id: buildingId });
}
