import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBuildingPremium } from "@/lib/buildingPremium";
import FinanceClient from "./ui";

export default async function BuildingFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/finansije`);

  const premium = await isBuildingPremium(supabase, id);

  if (!premium) {
    return (
      <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
        <main className="w-full max-w-5xl">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
              ★
            </div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Finansije — Premium funkcija
            </h1>
            <p className="mt-2 text-sm text-zinc-600 max-w-md mx-auto">
              Finansijsko praćenje (prihodi, rashodi, računi i dokazi) dostupno je samo za zgrade s
              aktivnim Premium planom.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/zgrade/${id}/pretplata`}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Aktivirajte Premium — 500 RSD/mes.
              </Link>
              <Link
                href={`/zgrade/${id}`}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Nazad na zgradu
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { data: tx } = await supabase
    .from("building_transactions")
    .select(
      "id, transaction_type, category, amount, currency, transaction_date, description, status, created_at",
    )
    .eq("building_id", id)
    .order("transaction_date", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Finansije</h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Premium
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Transparentno praćenje prihoda i rashoda zgrade.
          </p>
          <FinanceClient buildingId={id} initial={tx ?? []} />
        </div>
      </main>
    </div>
  );
}
