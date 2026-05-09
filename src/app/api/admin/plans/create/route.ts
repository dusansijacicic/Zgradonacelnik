import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  price_monthly: z.number().nonnegative(),
  max_buildings: z.number().int().positive().nullable().optional(),
  features: z.any(),
  active: z.boolean().optional(),
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

  const { data: row, error } = await supabase
    .from("subscription_plans")
    .insert({
      name: body.data.name,
      price_monthly: body.data.price_monthly,
      max_buildings: body.data.max_buildings ?? null,
      features: body.data.features ?? {},
      active: body.data.active ?? true,
    })
    .select("id, name, price_monthly, max_buildings, features, active")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  return NextResponse.json({ row });
}

