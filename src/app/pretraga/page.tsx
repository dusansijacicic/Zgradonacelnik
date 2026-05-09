import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StatRow = {
  manager_user_id: string;
  average_rating: number | null;
  review_count: number | null;
  last_review_at: string | null;
};

type RegistryRpcRow = {
  id: number;
  full_name: string;
  municipality: string | null;
  license_number: string | null;
  email: string | null;
  phone: string | null;
  source_url: string | null;
  raw_data: Record<string, unknown> | null;
  platform_user_id: string | null;
  average_rating: number | null;
  review_count: number | null;
  active_buildings_count: number | null;
  historical_buildings_count: number | null;
  last_review_at: string | null;
};

type BuildingRpcRow = {
  building_id: string;
  city: string | null;
  municipality: string | null;
  street: string | null;
  street_number: string | null;
  manager_user_id: string;
  manager_display_name: string | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    city?: string;
    municipality?: string;
    verified?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const q = (sp.q ?? "").trim();
  const city = (sp.city ?? "").trim();
  const municipality = (sp.municipality ?? "").trim();
  const verified = sp.verified === "1";
  const sort = sp.sort ?? "rating_desc";

  let query = supabase
    .from("user_profiles")
    .select("user_id, display_name, city, municipality, professional_manager_status")
    .eq("user_type", "professional_manager");

  if (verified) query = query.eq("professional_manager_status", "verified");
  if (city) query = query.ilike("city", `%${city}%`);
  if (municipality) query = query.ilike("municipality", `%${municipality}%`);
  if (q) query = query.ilike("display_name", `%${q}%`);

  const { data: managers } = await query.limit(100);

  const ids = (managers ?? []).map((m) => m.user_id);
  const { data: stats } = ids.length
    ? await supabase
        .from("manager_stats")
        .select("manager_user_id, average_rating, review_count, last_review_at")
        .in("manager_user_id", ids)
    : { data: [] as StatRow[] };

  const statsById = new Map<string, StatRow>();
  for (const s of stats ?? []) statsById.set(s.manager_user_id, s);

  const merged =
    (managers ?? []).map((m) => ({
      ...m,
      average_rating: statsById.get(m.user_id)?.average_rating ?? null,
      review_count: statsById.get(m.user_id)?.review_count ?? 0,
      last_review_at: statsById.get(m.user_id)?.last_review_at ?? null,
    })) ?? [];

  merged.sort((a, b) => {
    if (sort === "reviews_desc") return (b.review_count ?? 0) - (a.review_count ?? 0);
    if (sort === "newest_review") {
      const ad = a.last_review_at ? new Date(a.last_review_at).getTime() : 0;
      const bd = b.last_review_at ? new Date(b.last_review_at).getTime() : 0;
      return bd - ad;
    }
    return Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0);
  });

  const { data: regRpc, error: regRpcErr } = await supabase.rpc("rpc_pretraga_registry", {
    p_q: q,
    p_municipality: municipality,
    p_limit: 200,
  });

  let registry = (regRpc ?? []) as RegistryRpcRow[];

  if (!regRpcErr && registry.length) {
    registry.sort((a, b) => {
      if (sort === "reviews_desc") return (b.review_count ?? 0) - (a.review_count ?? 0);
      if (sort === "newest_review") {
        const ad = a.last_review_at ? new Date(a.last_review_at).getTime() : 0;
        const bd = b.last_review_at ? new Date(b.last_review_at).getTime() : 0;
        return bd - ad;
      }
      return Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0);
    });
  }

  const { data: bRpc, error: bRpcErr } = await supabase.rpc("rpc_public_active_manager_buildings", {
    p_limit: 150,
  });
  const buildings = (bRpc ?? []) as BuildingRpcRow[];

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Pretraga upravnika</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Državni registar (do 250 rezultata), nalozi na platformi sa ocenama, i zgrade koje trenutno
          imaju <span className="font-medium text-zinc-800">aktivnog</span> upravnika.
        </p>

        {regRpcErr ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Registar se ne može učitati iz baze.</p>
            <p className="mt-1 text-amber-900/90">
              U Supabase SQL Editor pokreni migraciju{" "}
              <code className="rounded bg-white/70 px-1 text-xs">0003_pretraga_public_rpcs.sql</code>{" "}
              (funkcije <code className="text-xs">rpc_pretraga_registry</code> i{" "}
              <code className="text-xs">rpc_public_active_manager_buildings</code>). Greška:{" "}
              {regRpcErr.message}
            </p>
          </div>
        ) : null}

        {bRpcErr && !regRpcErr ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            Lista zgrada: {bRpcErr.message} — proveri da li je ista migracija primenjena.
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-5">
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm sm:col-span-2"
            placeholder="Ime ili email (q)"
            defaultValue={q}
            name="q"
            form="searchForm"
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            placeholder="Grad"
            defaultValue={city}
            name="city"
            form="searchForm"
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            placeholder="Opština / mesto"
            defaultValue={municipality}
            name="municipality"
            form="searchForm"
          />
          <select
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            defaultValue={sort}
            name="sort"
            form="searchForm"
          >
            <option value="rating_desc">Najbolja prosečna ocena</option>
            <option value="reviews_desc">Najviše recenzija</option>
            <option value="newest_review">Najnovija recenzija</option>
          </select>

          <form
            id="searchForm"
            method="get"
            action="/pretraga"
            className="flex flex-wrap gap-3 sm:col-span-5"
          >
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="verified" value="1" defaultChecked={verified} />
              Samo verifikovani (samo platforma)
            </label>
            <button
              type="submit"
              className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
            >
              Primeni filtere
            </button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/pretraga/mapa" className="font-medium text-zinc-900 underline underline-offset-4">
            Radius pretraga (mapa) →
          </Link>
          <Link href="/zgrade" className="font-medium text-zinc-900 underline underline-offset-4">
            Sve zgrade →
          </Link>
        </div>

        <h2 className="mt-10 text-lg font-semibold tracking-tight text-zinc-900">
          Državni registar + ocene (ako ima nalog)
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Ocene i broj zgrada na platformi vide se kada je upravnik{" "}
          <span className="font-medium">verifikovan</span> i povezan sa redom u registru. Inače su
          polja prazna.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {regRpcErr ? null : registry.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
              Nema rezultata za zadate filtere.
            </p>
          ) : (
            registry.map((r) => {
              const status =
                typeof r.raw_data?.Status === "string"
                  ? r.raw_data.Status
                  : typeof r.raw_data?.status === "string"
                    ? r.raw_data.status
                    : null;
              const inner = (
                <>
                  <div className="text-sm font-medium text-zinc-900">{r.full_name}</div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {r.municipality ?? "—"}
                    {r.license_number ? ` • Lic. ${r.license_number}` : ""}
                  </div>
                  {r.email ? (
                    <div className="mt-1 truncate text-xs text-zinc-600">{r.email}</div>
                  ) : null}
                  {r.phone ? <div className="mt-0.5 text-xs text-zinc-500">{r.phone}</div> : null}
                  <div className="mt-3 grid gap-1 border-t border-emerald-200/60 pt-2 text-xs text-zinc-700">
                    <div>
                      <span className="text-zinc-500">Prosečna ocena: </span>
                      <span className="font-semibold tabular-nums">
                        {r.average_rating != null ? Number(r.average_rating).toFixed(2) : "—"}
                      </span>
                      {r.platform_user_id ? (
                        <span className="text-zinc-500">
                          {" "}
                          ({r.review_count ?? 0} recenzija)
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <span className="text-zinc-500">Aktivne zgrade (platforma): </span>
                      <span className="font-medium tabular-nums">{r.active_buildings_count ?? 0}</span>
                      <span className="text-zinc-500"> • istorija: </span>
                      <span className="font-medium tabular-nums">
                        {r.historical_buildings_count ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                    {status ? (
                      <span className="rounded bg-white/80 px-2 py-0.5">{status}</span>
                    ) : null}
                    {r.source_url ? (
                      <span className="rounded bg-white/80 px-2 py-0.5">Izvor: {r.source_url}</span>
                    ) : null}
                  </div>
                </>
              );
              return r.platform_user_id ? (
                <Link
                  key={r.id}
                  href={`/upravnik/${r.platform_user_id}`}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition-colors hover:bg-emerald-50"
                >
                  {inner}
                  <div className="mt-2 text-xs font-medium text-emerald-800">Profil na platformi →</div>
                </Link>
              ) : (
                <div
                  key={r.id}
                  className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-left"
                >
                  {inner}
                </div>
              );
            })
          )}
        </div>

        <h2 className="mt-10 text-lg font-semibold tracking-tight text-zinc-900">
          Na platformi (Google nalog)
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Samo korisnici sa tipom profesionalni upravnik. Filter „Samo verifikovani“ važi ovde.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {merged.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
              Nema prijavljenih upravnika za ove filtere.
            </p>
          ) : (
            merged.map((m) => (
              <Link
                key={m.user_id}
                href={`/upravnik/${m.user_id}`}
                className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
              >
                <div className="text-sm font-medium text-zinc-900">{m.display_name ?? "Upravnik"}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {m.city ?? "—"} {m.municipality ? `• ${m.municipality}` : ""} •{" "}
                  {m.professional_manager_status}
                </div>
                <div className="mt-2 text-xs text-zinc-600">
                  Ocena:{" "}
                  <span className="font-semibold">
                    {m.average_rating != null ? Number(m.average_rating).toFixed(2) : "—"}
                  </span>
                  <span className="text-zinc-500"> • Recenzije: {m.review_count ?? 0}</span>
                </div>
              </Link>
            ))
          )}
        </div>

        <h2 className="mt-10 text-lg font-semibold tracking-tight text-zinc-900">
          Zgrade sa aktivnim upravnikom
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Aktivna dodela u <code className="text-[11px]">building_manager_assignments</code>. Detalji
          zgrade za nečlanove mogu biti ograničeni RLS-om na stranici zgrade.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2">Grad</th>
                <th className="px-3 py-2">Ulica</th>
                <th className="px-3 py-2">Upravnik</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {bRpcErr ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-zinc-500">
                    Nema podataka (greška RPC).
                  </td>
                </tr>
              ) : buildings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-zinc-500">
                    Još nema aktivnih dodela upravnika zgradama.
                  </td>
                </tr>
              ) : (
                buildings.map((b) => (
                  <tr key={b.building_id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-2 text-zinc-800">
                      {b.city ?? "—"}
                      {b.municipality ? (
                        <span className="block text-xs text-zinc-500">{b.municipality}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-zinc-800">
                      {b.street ?? "—"} {b.street_number ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/upravnik/${b.manager_user_id}`}
                        className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                      >
                        {b.manager_display_name ?? "Upravnik"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/zgrade/${b.building_id}`}
                        className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline"
                      >
                        Zgrada →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
