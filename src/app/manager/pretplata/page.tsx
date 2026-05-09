import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ManagerSubscriptionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/pretplata");

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("id, name, price_monthly, max_buildings, features, active")
    .eq("active", true)
    .order("price_monthly", { ascending: true });

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Pretplata (MVP stub)
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Plaćanje nije implementirano, ali modeli postoje. Ovde biramo plan i
            kasnije povezujemo payment provider.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(plans ?? []).map((p: any) => (
              <div key={p.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="text-sm font-medium text-zinc-900">{p.name}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {p.price_monthly} RSD / месечно • max zgrada:{" "}
                  {p.max_buildings ?? "—"}
                </div>
                <pre className="mt-3 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                  {JSON.stringify(p.features ?? {}, null, 2)}
                </pre>
              </div>
            ))}
            {!plans?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Nema planova. Dodaj ih kroz admin.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

