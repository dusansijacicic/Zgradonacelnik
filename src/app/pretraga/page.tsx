import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  // Pull candidates from profiles, then fetch stats (MVP-friendly; can be optimized later)
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
    : { data: [] as any[] };

  const statsById = new Map<string, any>();
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
    // rating_desc default
    return (Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0));
  });

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Pretraga upravnika
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Napredna pretraga (MVP): query parametri + sortiranje + priprema za mapu/radius.
        </p>

        <div className="mt-6 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-5">
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm sm:col-span-2"
            placeholder="Ime (q=...)"
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
            placeholder="Opština"
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
            <option value="rating_desc">Najbolja ocena</option>
            <option value="reviews_desc">Najviše recenzija</option>
            <option value="newest_review">Najnovije recenzije</option>
          </select>

          <form id="searchForm" className="sm:col-span-5 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="verified" value="1" defaultChecked={verified} />
              Samo verifikovani
            </label>
            <button className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">
              Primeni filtere
            </button>
          </form>
        </div>

        <div className="mt-4">
          <Link
            href="/pretraga/mapa"
            className="text-sm font-medium text-zinc-900 underline underline-offset-4"
          >
            Otvori mapu (stub) →
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {merged.map((m) => (
            <Link
              key={m.user_id}
              href={`/upravnik/${m.user_id}`}
              className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
            >
              <div className="text-sm font-medium text-zinc-900">
                {m.display_name ?? "Upravnik"}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {m.city ?? "—"} {m.municipality ? `• ${m.municipality}` : ""} •{" "}
                {m.professional_manager_status}
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Ocena: {m.average_rating ?? "-"} • Recenzije: {m.review_count ?? 0}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

