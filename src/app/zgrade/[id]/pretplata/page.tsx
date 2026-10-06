import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBuildingSubscription } from "@/lib/buildingPremium";
import { formatAddress } from "@/lib/api";
import { PREMIUM_PRICE_PER_BUILDING_RSD } from "@/lib/payment";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktivan",
  pending_payment: "Čeka uplatu",
  expired: "Istekao",
  cancelled: "Otkazan",
  inactive: "Neaktivan",
};

export default async function BuildingPretplataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/pretplata`);

  const { data: building } = await supabase
    .from("buildings")
    .select("id, city, street, street_number, entrance")
    .eq("id", id)
    .maybeSingle();
  if (!building) notFound();

  const [{ data: assignment }, subscription] = await Promise.all([
    supabase
      .from("building_manager_assignments")
      .select("id")
      .eq("building_id", id)
      .eq("manager_user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    getBuildingSubscription(supabase, id),
  ]);

  const isActive = subscription?.status === "active";

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl space-y-4">
        <Link href={`/zgrade/${id}`} className="text-sm text-zinc-500 hover:text-zinc-800">← Nazad na zgradu</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Premium zgrade</h1>
              <p className="mt-1 text-sm text-zinc-500">{formatAddress(building)}</p>
            </div>
            {subscription ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isActive ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {STATUS_LABELS[subscription.status] ?? subscription.status}
              </span>
            ) : null}
          </div>

          {isActive && subscription?.current_period_end ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Premium je aktivan do <strong>{new Date(subscription.current_period_end).toLocaleDateString("sr-RS")}</strong>.
              Svi verifikovani stanari vide finansije, zapisnike i dokumenta.
            </div>
          ) : null}

          <ul className="mt-5 space-y-2 text-sm text-zinc-700">
            <li>✓ Finansije zgrade: prilivi, odlivi, dokazi, istorija izmena</li>
            <li>✓ Zapisnici sa skupština i odluke</li>
            <li>✓ Dokumenta dostupna svim stanarima</li>
            <li>✓ Oznaka „Transparentna zgrada“ u pretrazi</li>
          </ul>
          <p className="mt-4 text-sm text-zinc-600">
            Cena: <strong>{PREMIUM_PRICE_PER_BUILDING_RSD} RSD mesečno</strong> po zgradi (ulazu). Plaća upravnik zgrade.
          </p>

          <div className="mt-6">
            {assignment ? (
              <Link
                href="/manager/pretplata"
                className="inline-flex h-11 items-center rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-700"
              >
                {isActive ? "Produži Premium →" : "Aktiviraj Premium →"}
              </Link>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Premium aktivira upravnik zgrade. Ako vaša zgrada još nema upravnika na platformi, povežite ga sa
                stranice zgrade ili pozovite upravnike iz registra da pošalju ponudu.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
