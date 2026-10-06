import { NextResponse, after } from "next/server";
import { z } from "zod";
import { formatAddress, getSessionUser, isAdmin, jsonError, rateLimit, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { newPaymentReference, orderAmountRsd, paymentDetails } from "@/lib/payment";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  building_ids: z.array(z.string().uuid()).min(1).max(200),
  months: z.union([z.literal(1), z.literal(6), z.literal(12)]),
});

/** Upravnik pravi porudžbinu Premium-a za svoje zgrade → dobija podatke za uplatu. */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited = await rateLimit(supabase, "subscription_order", 20, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);
  const buildingIds = Array.from(new Set(body.data.building_ids));

  const admin = createSupabaseAdminClient();
  const userIsAdmin = await isAdmin(supabase, user.id);

  if (!userIsAdmin) {
    const { data: assignments } = await admin
      .from("building_manager_assignments")
      .select("building_id")
      .eq("manager_user_id", user.id)
      .eq("status", "active")
      .in("building_id", buildingIds);
    const managed = new Set((assignments ?? []).map((a) => a.building_id));
    if (buildingIds.some((id) => !managed.has(id))) {
      return jsonError("not_manager", 403, "Premium možeš poručiti samo za zgrade u kojima si aktivni upravnik.");
    }
  }

  // Ista zgrada ne sme biti u dve neplaćene porudžbine istovremeno.
  const { data: openOrders } = await admin
    .from("subscription_orders")
    .select("id, building_ids")
    .eq("status", "pending_payment")
    .overlaps("building_ids", buildingIds);
  if (openOrders?.length) {
    return jsonError(
      "order_exists",
      409,
      "Za neku od izabranih zgrada već postoji neplaćena porudžbina. Plati je ili je otkaži u pregledu porudžbina.",
    );
  }

  const amount = orderAmountRsd(buildingIds.length, body.data.months);
  let order: { id: string; payment_reference: string; amount_rsd: number; months: number } | null = null;
  for (let i = 0; i < 3 && !order; i++) {
    const { data, error } = await admin
      .from("subscription_orders")
      .insert({
        payment_reference: newPaymentReference(),
        ordered_by: user.id,
        building_ids: buildingIds,
        months: body.data.months,
        amount_rsd: amount,
      })
      .select("id, payment_reference, amount_rsd, months")
      .single();
    if (data) order = data;
    else if (error?.code !== "23505") return jsonError("db_error", 500);
  }
  if (!order) return jsonError("db_error", 500);

  // Prikaži "čeka uplatu" na zgradama koje trenutno nemaju aktivan Premium (aktivne se samo produžuju).
  const { data: existingSubs } = await admin
    .from("building_subscriptions")
    .select("building_id, status, current_period_end")
    .in("building_id", buildingIds);
  const subByBuilding = new Map((existingSubs ?? []).map((s) => [s.building_id, s]));
  const pendingPatch = {
    subscribed_by: user.id,
    status: "pending_payment",
    payment_reference: order.payment_reference,
    amount_rsd: Math.round(amount / buildingIds.length),
  };
  for (const buildingId of buildingIds) {
    const sub = subByBuilding.get(buildingId);
    const activeNow =
      sub?.status === "active" && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
    if (!sub) await admin.from("building_subscriptions").insert({ building_id: buildingId, ...pendingPatch });
    else if (!activeNow) await admin.from("building_subscriptions").update(pendingPatch).eq("building_id", buildingId);
  }

  const created = order;
  after(async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    const { data: buildings } = await admin
      .from("buildings")
      .select("street, street_number, entrance, city")
      .in("id", buildingIds);
    await sendEmail({
      to: adminEmail,
      subject: `Nova porudžbina Premium-a — ${created.amount_rsd} RSD (${created.payment_reference})`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">
          <h2>Nova porudžbina</h2>
          <p>Poziv na broj (97): <strong style="font-family:monospace">${created.payment_reference}</strong><br/>
          Iznos: <strong>${created.amount_rsd} RSD</strong> · ${created.months} mes.</p>
          <ul>${(buildings ?? []).map((b) => `<li>${formatAddress(b)}</li>`).join("")}</ul>
          <a href="${siteUrl()}/admin/pretplate">Potvrdi uplatu u admin panelu →</a>
        </div>`,
    }).catch((e) => console.error("[order email]", e));
  });

  return NextResponse.json({ order: created, payment: paymentDetails() });
}

/** Otkazivanje sopstvene neplaćene porudžbine. */
export async function DELETE(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("bad_request", 400);

  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select("id, ordered_by, status, building_ids, payment_reference")
    .eq("id", id)
    .maybeSingle();
  if (!order || order.ordered_by !== user.id) return jsonError("not_found", 404);
  if (order.status !== "pending_payment") return jsonError("not_pending", 400);

  await admin.from("subscription_orders").update({ status: "cancelled" }).eq("id", id);
  await admin
    .from("building_subscriptions")
    .update({ status: "inactive" })
    .in("building_id", order.building_ids)
    .eq("status", "pending_payment")
    .eq("payment_reference", order.payment_reference);

  return NextResponse.json({ ok: true });
}
