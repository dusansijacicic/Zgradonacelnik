import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  transaction_type: z.enum(["inflow", "outflow"]),
  category: z.string().max(100).nullable().optional(),
  amount: z.number().nonnegative(),
  transaction_date: z.string().min(10),
  description: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "transaction_create", limit: 200, windowSeconds: 3600 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("building_transactions")
    .insert({
      building_id: body.data.building_id,
      manager_user_id: user.id,
      transaction_type: body.data.transaction_type,
      category: body.data.category ?? null,
      amount: body.data.amount,
      currency: "RSD",
      transaction_date: body.data.transaction_date,
      description: body.data.description ?? null,
      created_by: user.id,
      visibility: "residents_only",
      status: "active",
    })
    .select(
      "id, transaction_type, category, amount, currency, transaction_date, description, status, created_at",
    )
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await supabase.from("transaction_audit_log").insert({
    transaction_id: row.id,
    changed_by: user.id,
    action: "created",
    old_data: null,
    new_data: row,
  });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "transaction_create",
    entity_type: "building_transactions",
    entity_id: row.id,
    metadata: { building_id: body.data.building_id },
  });

  return NextResponse.json({ row });
}

