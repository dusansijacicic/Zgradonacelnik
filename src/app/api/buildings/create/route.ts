import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  mapbox_id: z.string().optional(),
  country: z.string().optional(),
  city: z.string().min(1),
  municipality: z.string().optional(),
  settlement: z.string().optional(),
  street: z.string().min(1),
  street_number: z.string().min(1),
  entrance: z.string().optional(),
  postal_code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { mapbox_id, latitude, longitude, entrance, ...fields } = body.data;

  // If mapbox_id provided, check for existing building first (fast path)
  if (mapbox_id) {
    const { data: existing } = await supabase
      .from("buildings")
      .select("id")
      .eq("mapbox_id", mapbox_id)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("building_memberships").insert({
        building_id: existing.id,
        user_id: user.id,
        role: "resident",
        verification_status: "unverified",
        verification_method: null,
      }).throwOnError().catch(() => null); // ignore 23505 duplicate
      return NextResponse.json({ id: existing.id, duplicate: true });
    }
  }

  const payload: Record<string, unknown> = {
    country: fields.country ?? "Srbija",
    city: fields.city,
    municipality: fields.municipality ?? null,
    settlement: fields.settlement ?? null,
    street: fields.street,
    street_number: fields.street_number,
    entrance: entrance ?? null,
    postal_code: fields.postal_code ?? null,
    created_by: user.id,
    ...(mapbox_id ? { mapbox_id } : {}),
    ...(latitude != null ? { latitude } : {}),
    ...(longitude != null ? { longitude } : {}),
  };

  const { data: inserted, error: insErr } = await supabase
    .from("buildings")
    .insert(payload)
    .select("id")
    .maybeSingle();

  let buildingId = inserted?.id as string | undefined;
  let duplicate = false;

  if (insErr) {
    // Duplicate address_hash — find existing row
    const { data: existing } = await supabase
      .from("buildings")
      .select("id")
      .eq("city", fields.city)
      .eq("street", fields.street)
      .eq("street_number", fields.street_number)
      .is("entrance", entrance ?? null)
      .maybeSingle();

    if (!existing?.id) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
    buildingId = existing.id;
    duplicate = true;

    // Backfill mapbox_id + coords if missing
    if (mapbox_id || latitude != null) {
      await supabase
        .from("buildings")
        .update({
          ...(mapbox_id ? { mapbox_id } : {}),
          ...(latitude != null ? { latitude } : {}),
          ...(longitude != null ? { longitude } : {}),
        })
        .eq("id", buildingId)
        .is("mapbox_id", null);
    }
  }

  // Create membership for creator (unverified resident)
  const { error: memErr } = await supabase.from("building_memberships").insert({
    building_id: buildingId,
    user_id: user.id,
    role: "resident",
    verification_status: "unverified",
    verification_method: null,
  });
  if (memErr && memErr.code !== "23505") {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ id: buildingId, duplicate });
}
