import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_registry_municipalities");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  const names = (data ?? []).map((r: { name: string }) => r.name).filter(Boolean);
  return NextResponse.json({ municipalities: names });
}
