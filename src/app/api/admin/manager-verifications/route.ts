import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isAdmin, jsonError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { claimRegistry } from "@/lib/registryClaim";

const bodySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

/** Ručna odluka admina (npr. upravnik ne može da pristupi emailu iz registra pa je poslao dokaz drugim putem). */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  if (!(await isAdmin(supabase, user.id))) return jsonError("forbidden", 403);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);

  const admin = createSupabaseAdminClient();
  const { data: req } = await admin
    .from("manager_verification_requests")
    .select("id, user_id, registry_id")
    .eq("id", body.data.id)
    .maybeSingle();
  if (!req) return jsonError("not_found", 404);

  if (body.data.action === "approve") {
    if (!req.registry_id) {
      return jsonError("no_registry", 400, "Zahtev nije vezan za red u registru — upravnik mora postojati u registru PKS.");
    }
    const claim = await claimRegistry(req.user_id, req.registry_id);
    if (!claim.ok) return jsonError("already_claimed", 409, "Ovaj red registra je već povezan sa drugim nalogom.");
  }

  await admin
    .from("manager_verification_requests")
    .update({
      status: body.data.action === "approve" ? "verified" : "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      otp_hash: null,
    })
    .eq("id", req.id);

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: `manager_verification_${body.data.action}`,
    entity_type: "manager_verification_requests",
    entity_id: req.id,
    metadata: { registry_id: req.registry_id },
  });

  return NextResponse.json({ ok: true });
}
