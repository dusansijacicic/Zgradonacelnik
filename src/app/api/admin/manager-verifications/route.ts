import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
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

  const { data: reqRow, error: reqErr } = await supabase
    .from("manager_verification_requests")
    .select("id, user_id")
    .eq("id", body.data.id)
    .single();

  if (reqErr || !reqRow)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const newStatus = body.data.action === "approve" ? "verified" : "rejected";

  await supabase
    .from("manager_verification_requests")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reqRow.id);

  await supabase
    .from("user_profiles")
    .update({
      user_type: "professional_manager",
      professional_manager_status: newStatus,
    })
    .eq("user_id", reqRow.user_id);

  return NextResponse.json({ ok: true });
}

