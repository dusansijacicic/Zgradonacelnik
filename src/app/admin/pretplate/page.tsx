import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/api";
import AdminPretplateClient from "./ui";

export default async function AdminPretplatePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/pretplate");

  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const [{ data: orders }, { data: subs }] = await Promise.all([
    supabase
      .from("subscription_orders")
      .select("id, order_number, payment_reference, amount_rsd, months, status, building_ids, ordered_by, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("building_subscriptions")
      .select("building_id, status, current_period_end, subscribed_by, buildings(street, street_number, entrance, city)")
      .in("status", ["active", "expired"])
      .order("current_period_end", { ascending: true })
      .limit(500),
  ]);

  const buildingIds = Array.from(new Set((orders ?? []).flatMap((o) => o.building_ids as string[])));
  const userIds = Array.from(new Set([...(orders ?? []).map((o) => o.ordered_by), ...(subs ?? []).map((s) => s.subscribed_by)]));
  const [{ data: buildings }, { data: people }] = await Promise.all([
    buildingIds.length
      ? supabase.from("buildings").select("id, street, street_number, entrance, city").in("id", buildingIds)
      : Promise.resolve({ data: [] as { id: string; street: string; street_number: string; entrance: string | null; city: string }[] }),
    userIds.length
      ? supabase.from("user_profiles").select("user_id, display_name").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] }),
  ]);
  const addr = new Map((buildings ?? []).map((b) => [b.id, formatAddress(b)]));
  const name = new Map((people ?? []).map((p) => [p.user_id, p.display_name ?? "—"]));

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl space-y-4">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">← Admin</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Premium — porudžbine i uplate</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Uporedi poziv na broj sa izvodom iz banke, pa potvrdi uplatu. Aktivnim zgradama se period produžava.
          </p>
          <AdminPretplateClient
            orders={(orders ?? []).map((o) => ({
              id: o.id,
              reference: o.payment_reference,
              amount: o.amount_rsd,
              months: o.months,
              status: o.status,
              createdAt: o.created_at,
              paidAt: o.paid_at,
              orderedBy: name.get(o.ordered_by) ?? o.ordered_by,
              addresses: (o.building_ids as string[]).map((id) => addr.get(id) ?? id),
            }))}
            subscriptions={(subs ?? []).map((s) => ({
              buildingId: s.building_id,
              status: s.status,
              periodEnd: s.current_period_end,
              address: formatAddress(s.buildings as unknown as { street: string; street_number: string; entrance: string | null; city: string }),
              manager: name.get(s.subscribed_by) ?? "—",
            }))}
          />
        </div>
      </main>
    </div>
  );
}
