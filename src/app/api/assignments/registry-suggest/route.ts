import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  registry_id: z.coerce.number().int().positive(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "registry_assignment_suggest", limit: 30, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: reg, error: regErr } = await supabase
    .from("professional_manager_registry")
    .select("id")
    .eq("id", body.data.registry_id)
    .maybeSingle();
  if (regErr || !reg) return NextResponse.json({ error: "registry_not_found" }, { status: 404 });

  const { data: row, error } = await supabase
    .from("building_manager_assignments")
    .insert({
      building_id: body.data.building_id,
      registry_id: body.data.registry_id,
      manager_user_id: null,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "duplicate", detail: "Za ovu zgradu već postoji predlog ili aktivna dodela za tog upravnika u registru." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "registry_assignment_suggest",
    entity_type: "building_manager_assignments",
    entity_id: row.id,
    metadata: { building_id: body.data.building_id, registry_id: body.data.registry_id },
  });

  return NextResponse.json({ id: row.id, status: row.status });
}
