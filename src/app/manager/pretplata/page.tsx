import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/api";
import { BILLING_OPTIONS, PREMIUM_PRICE_PER_BUILDING_RSD, paymentDetails } from "@/lib/payment";
import ManagerSubscriptionClient from "./ui";

export default async function ManagerSubscriptionPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/pretplata");

  const { data: assignments } = await supabase
    .from("building_manager_assignments")
    .select("building_id, buildings(id, street, street_number, entrance, city)")
    .eq("manager_user_id", user.id)
    .eq("status", "active");

  const buildingIds = (assignments ?? []).map((a) => a.building_id);
  const [{ data: subs }, { data: orders }] = await Promise.all([
    buildingIds.length
      ? supabase
          .from("building_subscriptions")
          .select("building_id, status, current_period_end")
          .in("building_id", buildingIds)
      : Promise.resolve({ data: [] as { building_id: string; status: string; current_period_end: string | null }[] }),
    supabase
      .from("subscription_orders")
      .select("id, payment_reference, amount_rsd, months, status, building_ids, created_at, paid_at")
      .eq("ordered_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const subByBuilding = new Map((subs ?? []).map((s) => [s.building_id, s]));
  const buildings = (assignments ?? []).map((a) => {
    const b = a.buildings as unknown as { id: string; street: string; street_number: string; entrance: string | null; city: string };
    const sub = subByBuilding.get(a.building_id);
    const active = sub?.status === "active" && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
    return {
      id: a.building_id,
      address: formatAddress(b),
      active,
      periodEnd: active ? sub?.current_period_end ?? null : null,
      pending: sub?.status === "pending_payment",
    };
  });

  const addressById = Object.fromEntries(buildings.map((b) => [b.id, b.address]));

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl space-y-4">
        <Link href="/manager" className="text-sm text-zinc-500 hover:text-zinc-800">← Panel upravnika</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Premium za moje zgrade</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {PREMIUM_PRICE_PER_BUILDING_RSD} RSD mesečno po zgradi. Otključava finansije, zapisnike i dokumenta za
            sve stanare zgrade. Godišnje plaćanje: 2 meseca gratis. Jedna uplata može pokriti više zgrada.
          </p>
          <ManagerSubscriptionClient
            buildings={buildings}
            billingOptions={BILLING_OPTIONS.map((o) => ({ months: o.months, label: o.label, paidMonths: o.paidMonths }))}
            pricePerMonth={PREMIUM_PRICE_PER_BUILDING_RSD}
            payment={paymentDetails()}
            orders={(orders ?? []).map((o) => ({
              ...o,
              addresses: (o.building_ids as string[]).map((id) => addressById[id] ?? "zgrada"),
            }))}
          />
        </div>
      </main>
    </div>
  );
}
