import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, jsonError, rateLimit } from "@/lib/api";
import { isBuildingPremium } from "@/lib/buildingPremium";

const bodySchema = z.object({
  building_id: z.string().uuid(),
  transaction_type: z.enum(["inflow", "outflow"]),
  category: z.string().trim().max(100).nullable().optional(),
  amount: z.number().positive().max(1_000_000_000),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(2000).nullable().optional(),
  counterparty_name: z.string().trim().max(200).nullable().optional(),
});

/** Unos priliva/odliva. Audit trag piše trigger u bazi (ne može se zaobići iz klijenta). */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited = await rateLimit(supabase, "transaction_create", 200, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400, "Proveri iznos i datum.");

  const date = new Date(body.data.transaction_date);
  if (Number.isNaN(date.getTime()) || date > new Date(Date.now() + 24 * 3600 * 1000)) {
    return jsonError("bad_date", 400, "Datum ne može biti u budućnosti.");
  }

  if (!(await isBuildingPremium(supabase, body.data.building_id))) {
    return jsonError("premium_required", 403, "Finansije su dostupne zgradama sa aktivnim Premium-om.");
  }

  const { data: row, error } = await supabase
    .from("building_transactions")
    .insert({
      building_id: body.data.building_id,
      manager_user_id: user.id,
      transaction_type: body.data.transaction_type,
      category: body.data.category || null,
      amount: body.data.amount,
      currency: "RSD",
      transaction_date: body.data.transaction_date,
      description: body.data.description || null,
      counterparty_name: body.data.counterparty_name || null,
      created_by: user.id,
      visibility: "residents_only",
      status: "active",
    })
    .select("id, transaction_type, category, amount, currency, transaction_date, description, status, created_at")
    .single();

  if (error) {
    if (error.code === "42501") return jsonError("forbidden", 403, "Samo aktivni upravnik zgrade unosi finansije.");
    return jsonError("db_error", 500);
  }

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "transaction_create",
    entity_type: "building_transactions",
    entity_id: row.id,
    metadata: { building_id: body.data.building_id },
  });

  return NextResponse.json({ row });
}
