import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/api";
import OffersClient from "./ui";

export default async function ManagerOffersPage({ searchParams }: { searchParams: Promise<{ grad?: string; strana?: string }> }) {
  const { grad = "", strana = "1" } = await searchParams;
  const page = Math.max(1, Number.parseInt(strana, 10) || 1);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/ponude");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type, professional_manager_status, city")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.user_type !== "professional_manager" || profile.professional_manager_status !== "verified") {
    redirect("/manager/verifikacija");
  }

  const city = grad || profile.city || "";
  const pageSize = 30;
  const [{ data: buildings }, { data: myOffers }] = await Promise.all([
    supabase.rpc("rpc_buildings_without_manager", { p_city: city, p_limit: pageSize, p_offset: (page - 1) * pageSize }),
    supabase
      .from("manager_offers")
      .select("id, building_id, status, created_at, buildings(street, street_number, entrance, city)")
      .eq("manager_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const offered = new Set((myOffers ?? []).filter((o) => o.status === "sent").map((o) => o.building_id));

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl space-y-4">
        <Link href="/manager" className="text-sm text-zinc-500 hover:text-zinc-800">← Panel upravnika</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Zgrade bez upravnika na platformi</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Stanari ovih zgrada su registrovani, a zgrada još nema potvrđenog upravnika. Pošalji ponudu — stanari je vide
            na stranici zgrade zajedno sa tvojim ocenama.
          </p>
          <form className="mt-4 flex gap-2">
            <input
              name="grad"
              defaultValue={city}
              placeholder="Grad ili opština"
              className="h-10 flex-1 rounded-xl border border-zinc-200 px-3 text-sm"
            />
            <button className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">Traži</button>
          </form>
          <OffersClient
            buildings={((buildings ?? []) as {
              building_id: string;
              city: string;
              municipality: string | null;
              street: string;
              street_number: string;
              entrance: string | null;
              members_count: number;
              open_offers_count: number;
            }[]).map((b) => ({
              id: b.building_id,
              address: formatAddress(b),
              municipality: b.municipality,
              members: b.members_count,
              offers: b.open_offers_count,
              alreadyOffered: offered.has(b.building_id),
            }))}
          />
          <div className="mt-4 flex justify-between text-sm">
            {page > 1 ? (
              <Link href={`/manager/ponude?grad=${encodeURIComponent(city)}&strana=${page - 1}`} className="underline">← Prethodna</Link>
            ) : <span />}
            {(buildings ?? []).length === pageSize ? (
              <Link href={`/manager/ponude?grad=${encodeURIComponent(city)}&strana=${page + 1}`} className="underline">Sledeća →</Link>
            ) : null}
          </div>
        </div>

        {myOffers?.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Moje ponude</h2>
            <div className="mt-3 divide-y divide-zinc-100 text-sm">
              {myOffers.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">{formatAddress(o.buildings as unknown as Parameters<typeof formatAddress>[0])}</span>
                  <span className="text-xs text-zinc-500">
                    {o.status === "sent" ? "Aktivna" : o.status === "withdrawn" ? "Povučena" : "Sakrivena"} ·{" "}
                    {new Date(o.created_at).toLocaleDateString("sr-RS")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
