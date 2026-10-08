import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function GET() {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.rpc("rpc_registry_municipalities");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  const names = (data ?? []).map((r: { name: string }) => r.name).filter(Boolean);
  return NextResponse.json({ municipalities: names }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
