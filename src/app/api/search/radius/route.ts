import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const querySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().int().positive().max(50000),
});

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const url = new URL(request.url);
  const qs = querySchema.safeParse({
    lat: url.searchParams.get("lat"),
    lng: url.searchParams.get("lng"),
    radius: url.searchParams.get("radius"),
  });
  if (!qs.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: rows, error } = await supabase.rpc("search_managers_by_radius", {
    p_lat: qs.data.lat,
    p_lng: qs.data.lng,
    p_radius_meters: qs.data.radius,
  });
  if (error) return NextResponse.json({ error: "rpc_error" }, { status: 500 });

  const managerIds = Array.from(new Set((rows ?? []).map((r: any) => r.manager_user_id as string)));
  const buildingIds = Array.from(new Set((rows ?? []).map((r: any) => r.building_id as string)));

  const [{ data: profiles }, { data: buildings }] = await Promise.all([
    managerIds.length
      ? supabase
          .from("user_profiles")
          .select("user_id, display_name, city, municipality, professional_manager_status")
          .in("user_id", managerIds)
      : Promise.resolve({ data: [] as any[] }),
    buildingIds.length
      ? supabase
          .from("buildings")
          .select("id, latitude, longitude, street, street_number")
          .in("id", buildingIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profilesById = new Map<string, any>();
  for (const p of profiles ?? []) profilesById.set(p.user_id, p);

  const buildingsById = new Map<string, any>();
  for (const b of buildings ?? []) buildingsById.set(b.id, b);

  const out = (rows ?? []).map((r: any) => ({
    manager_user_id: r.manager_user_id,
    building_id: r.building_id,
    distance_meters: r.distance_meters,
    profile: profilesById.get(r.manager_user_id) ?? null,
    building: buildingsById.get(r.building_id) ?? null,
  }));

  return NextResponse.json({ results: out });
}

