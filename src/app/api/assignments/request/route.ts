import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  proof_document_id: z.string().uuid(),
  start_date: z.string().optional(), // YYYY-MM-DD
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "assignment_request", limit: 20, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Must be verified professional manager
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type, professional_manager_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profile?.user_type !== "professional_manager" ||
    profile?.professional_manager_status !== "verified"
  ) {
    return NextResponse.json({ error: "not_verified_manager" }, { status: 403 });
  }

  const { data: row, error } = await supabase
    .from("building_manager_assignments")
    .insert({
      building_id: body.data.building_id,
      manager_user_id: user.id,
      status: "pending",
      start_date: body.data.start_date ?? null,
      proof_document_id: body.data.proof_document_id,
    })
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "assignment_request",
    entity_type: "building_manager_assignments",
    entity_id: row.id,
    metadata: { building_id: body.data.building_id },
  });

  return NextResponse.json({ id: row.id, status: row.status });
}

