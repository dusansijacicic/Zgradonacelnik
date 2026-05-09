import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { geocodeAddressMapbox } from "@/lib/geocode";

const bodySchema = z.object({
  country: z.string().optional(),
  city: z.string().min(1),
  municipality: z.string().optional(),
  settlement: z.string().optional(),
  street: z.string().min(1),
  street_number: z.string().min(1),
  entrance: z.string().optional(),
  postal_code: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const payload = {
    country: body.data.country ?? "Srbija",
    city: body.data.city,
    municipality: body.data.municipality ?? null,
    settlement: body.data.settlement ?? null,
    street: body.data.street,
    street_number: body.data.street_number,
    entrance: body.data.entrance ?? null,
    postal_code: body.data.postal_code ?? null,
    created_by: user.id,
  };

  // Try insert; if duplicate, find existing by computed address_hash via select match
  const { data: inserted, error: insErr } = await supabase
    .from("buildings")
    .insert(payload)
    .select("id, address_hash")
    .maybeSingle();

  let buildingId = inserted?.id as string | undefined;
  let duplicate = false;

  if (insErr) {
    // Attempt to locate existing row by same normalized fields using address_hash function on DB side
    const { data: existing } = await supabase
      .from("buildings")
      .select("id")
      .eq("city", payload.city)
      .eq("street", payload.street)
      .eq("street_number", payload.street_number)
      .eq("entrance", payload.entrance)
      .maybeSingle();

    if (!existing?.id) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
    buildingId = existing.id;
    duplicate = true;
  }

  // Create membership for creator (unverified resident)
  const { error: memErr } = await supabase.from("building_memberships").insert({
    building_id: buildingId,
    user_id: user.id,
    role: "resident",
    verification_status: "unverified",
    verification_method: null,
  });
  // ignore duplicate membership inserts
  if (memErr && memErr.code !== "23505") {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Best-effort geocoding (optional; requires MAPBOX_ACCESS_TOKEN)
  try {
    const address = `${payload.street} ${payload.street_number}${
      payload.entrance ? `, ulaz ${payload.entrance}` : ""
    }, ${payload.city}${payload.municipality ? `, ${payload.municipality}` : ""}, ${payload.country}`;
    const coords = await geocodeAddressMapbox(address);
    if (coords) {
      await supabase
        .from("buildings")
        .update({ latitude: coords.lat, longitude: coords.lng })
        .eq("id", buildingId);
    }
  } catch {
    // ignore geocoding failures
  }

  return NextResponse.json({ id: buildingId, duplicate });
}

