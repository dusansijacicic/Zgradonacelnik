import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "end"]),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: row } = await supabase
    .from("building_manager_assignments")
    .select("id, manager_user_id")
    .eq("id", body.data.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch: any = { approved_by: user.id, approved_at: new Date().toISOString() };
  if (body.data.action === "approve") patch.status = "active";
  if (body.data.action === "reject") patch.status = "rejected";
  if (body.data.action === "end") {
    patch.status = "ended";
    patch.end_date = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from("building_manager_assignments")
    .update(patch)
    .eq("id", body.data.id);
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

