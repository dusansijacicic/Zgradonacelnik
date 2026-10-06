import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/api";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Čeka odobrenje", cls: "bg-amber-100 text-amber-800" },
  active: { label: "Aktivan upravnik", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Odbijeno", cls: "bg-red-100 text-red-700" },
  ended: { label: "Bivši upravnik", cls: "bg-zinc-100 text-zinc-600" },
  disputed: { label: "Sporno", cls: "bg-red-100 text-red-700" },
};

export default async function ManagerBuildingsPage({ searchParams }: { searchParams: Promise<{ poslato?: string }> }) {
  const { poslato } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/zgrade");

  const { data: assignments } = await supabase
    .from("building_manager_assignments")
    .select("id, building_id, status, start_date, end_date, source, created_at, buildings(street, street_number, entrance, city, municipality)")
    .eq("manager_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const activeIds = (assignments ?? []).filter((a) => a.status === "active").map((a) => a.building_id);
  const { data: subs } = activeIds.length
    ? await supabase.from("building_subscriptions").select("building_id, status, current_period_end").in("building_id", activeIds)
    : { data: [] as { building_id: string; status: string; current_period_end: string | null }[] };
  const premium = new Set(
    (subs ?? [])
      .filter((s) => s.status === "active" && (!s.current_period_end || new Date(s.current_period_end) > new Date()))
      .map((s) => s.building_id),
  );

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl space-y-4">
        <Link href="/manager" className="text-sm text-zinc-500 hover:text-zinc-800">← Panel upravnika</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Zgrade kojima upravljam</h1>
            <Link href="/manager/zgrade/nova" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
              + Dodaj zgradu
            </Link>
          </div>
          {poslato ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Zahtev je poslat. Javićemo ti emailom kad admin pregleda dokaz.
            </div>
          ) : null}

          <div className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {(assignments ?? []).map((a) => {
              const b = a.buildings as unknown as Parameters<typeof formatAddress>[0];
              const st = STATUS[a.status] ?? { label: a.status, cls: "bg-zinc-100" };
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Link href={`/zgrade/${a.building_id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 hover:underline">
                    {formatAddress(b)}
                  </Link>
                  {a.source === "resident" ? <span className="text-[11px] text-zinc-400">povezali stanari</span> : null}
                  {a.status === "active" ? (
                    premium.has(a.building_id) ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">⭐ Premium</span>
                    ) : (
                      <Link href="/manager/pretplata" className="text-[11px] font-semibold text-amber-700 underline">
                        Aktiviraj Premium
                      </Link>
                    )
                  ) : null}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
            {!assignments?.length ? (
              <div className="p-4 text-sm text-zinc-600">
                Još nema zgrada. Dodaj zgradu kojom upravljaš ili{" "}
                <Link href="/manager/ponude" className="font-semibold underline">ponudi usluge zgradama bez upravnika</Link>.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
