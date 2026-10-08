import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function GET() {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.rpc("rpc_public_active_manager_buildings", { p_limit: 300 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json({ rows: data ?? [] }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
}
