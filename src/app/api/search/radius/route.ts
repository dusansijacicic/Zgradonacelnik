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

  const ids = Array.from(new Set((rows ?? []).map((r: any) => r.manager_user_id)));
  const { data: profiles } = ids.length
    ? await supabase
        .from("user_profiles")
        .select("user_id, display_name, city, municipality, professional_manager_status")
        .in("user_id", ids)
    : { data: [] as any[] };

  const byId = new Map<string, any>();
  for (const p of profiles ?? []) byId.set(p.user_id, p);

  const out =
    (rows ?? []).map((r: any) => ({
      manager_user_id: r.manager_user_id,
      building_id: r.building_id,
      distance_meters: r.distance_meters,
      profile: byId.get(r.manager_user_id) ?? null,
    })) ?? [];

  return NextResponse.json({ results: out });
}

