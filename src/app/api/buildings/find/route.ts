import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const mapboxId = new URL(request.url).searchParams.get("mapbox_id");
  if (!mapboxId) return NextResponse.json({ error: "mapbox_id required" }, { status: 400 });

  const { data: building } = await supabase
    .from("buildings")
    .select("id")
    .eq("mapbox_id", mapboxId)
    .maybeSingle();

  return NextResponse.json({ building: building ?? null });
}
