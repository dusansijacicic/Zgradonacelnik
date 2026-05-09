import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FinanceClient from "./ui";

export default async function BuildingFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/finansije`);

  const { data: tx } = await supabase
    .from("building_transactions")
    .select("id, transaction_type, category, amount, currency, transaction_date, description, status, created_at")
    .eq("building_id", id)
    .order("transaction_date", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Finansije (MVP)
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Upravnik može da unosi transakcije; stanari vide prema RLS pravilima.
          </p>
          <FinanceClient buildingId={id} initial={tx ?? []} />
        </div>
      </main>
    </div>
  );
}

