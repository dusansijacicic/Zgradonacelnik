import { NextResponse, after } from "next/server";
import { z } from "zod";
import { formatAddress, getSessionUser, isAdmin, jsonError, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPremiumActivatedNotification } from "@/lib/email";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate_order"), order_id: z.string().uuid() }),
  z.object({ action: z.literal("cancel_order"), order_id: z.string().uuid() }),
  z.object({ action: z.literal("deactivate"), building_id: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  if (!(await isAdmin(supabase, user.id))) return jsonError("forbidden", 403);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);

  const admin = createSupabaseAdminClient();
  const data = body.data;

  if (data.action === "activate_order") {
    const { error } = await admin.rpc("activate_subscription_order", { p_order_id: data.order_id, p_admin: user.id });
    if (error) return jsonError("activate_failed", 400, error.message);

    await supabase.from("audit_log").insert({
      actor_user_id: user.id,
      action: "subscription_order_activate",
      entity_type: "subscription_orders",
      entity_id: data.order_id,
    });

    after(async () => {
      const { data: order } = await admin
        .from("subscription_orders")
        .select("ordered_by, building_ids")
        .eq("id", data.order_id)
        .maybeSingle();
      if (!order) return;
      const [{ data: u }, { data: subs }, { data: buildings }] = await Promise.all([
        admin.auth.admin.getUserById(order.ordered_by),
        admin.from("building_subscriptions").select("building_id, current_period_end").in("building_id", order.building_ids),
        admin.from("buildings").select("id, street, street_number, entrance, city").in("id", order.building_ids),
      ]);
      const email = u?.user?.email;
      if (!email) return;
      const until = (subs ?? [])
        .map((s) => s.current_period_end)
        .filter(Boolean)
        .sort()[0];
      await sendPremiumActivatedNotification({
        managerEmail: email,
        managerName: (u.user?.user_metadata?.full_name as string | undefined) ?? "Upravniče",
        buildingAddress: (buildings ?? []).map((b) => formatAddress(b)).join("; "),
        periodEnd: until ? new Date(until).toLocaleDateString("sr-RS") : "—",
        buildingUrl: `${siteUrl()}/manager/pretplata`,
      }).catch((e) => console.error("[activation email]", e));
    });

    return NextResponse.json({ ok: true });
  }

  if (data.action === "cancel_order") {
    const { data: order } = await admin
      .from("subscription_orders")
      .select("id, status, building_ids, payment_reference")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order || order.status !== "pending_payment") return jsonError("not_pending", 400);
    await admin.from("subscription_orders").update({ status: "cancelled", activated_by: user.id }).eq("id", order.id);
    await admin
      .from("building_subscriptions")
      .update({ status: "inactive" })
      .in("building_id", order.building_ids)
      .eq("status", "pending_payment")
      .eq("payment_reference", order.payment_reference);
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin
    .from("building_subscriptions")
    .update({ status: "cancelled", activated_by: user.id })
    .eq("building_id", data.building_id);
  if (error) return jsonError("db_error", 500);
  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "subscription_deactivate",
    entity_type: "buildings",
    entity_id: data.building_id,
  });
  return NextResponse.json({ ok: true });
}
