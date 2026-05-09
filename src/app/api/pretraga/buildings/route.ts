import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_public_active_manager_buildings", { p_limit: 300 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json({ rows: data ?? [] });
}
