import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RegistryManagerPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idRaw } = await params;
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id < 1) notFound();

  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("professional_manager_registry")
    .select("id, full_name, municipality, license_number")
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  const { data: reviews } = await supabase
    .from("manager_reviews")
    .select("id, rating_overall, title, content, created_at")
    .eq("registry_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(15);

  type ReplyRow = { review_id: string; content: string; created_at: string; updated_at: string };

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const { data: replies } = reviewIds.length
    ? await supabase
        .from("review_replies")
        .select("review_id, content, created_at, updated_at")
        .in("review_id", reviewIds)
    : { data: [] as ReplyRow[] };

  const repliesByReview = new Map<string, ReplyRow>();
  for (const rep of replies ?? []) repliesByReview.set(rep.review_id, rep);

  const { data: agg } = await supabase
    .from("manager_reviews")
    .select("rating_overall")
    .eq("registry_id", id)
    .eq("status", "published");

  const list = agg ?? [];
  const avg =
    list.length > 0
      ? (list.reduce((s, r) => s + (r.rating_overall ?? 0), 0) / list.length).toFixed(2)
      : null;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <p className="mb-4 text-sm text-zinc-600">
          <Link href="/pretraga" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
            ← Pretraga / registar
          </Link>
        </p>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{row.full_name}</h1>
              <p className="mt-2 text-sm text-zinc-600">
                Državni registar upravnika
                {row.municipality ? ` • ${row.municipality}` : ""}
                {row.license_number ? ` • Lic. ${row.license_number}` : ""}
              </p>
              <p className="mt-3 text-xs text-zinc-500">
                Ovaj upravnik možda još nema nalog na platformi. Recenzije su vezane za red u registru i
                (opciono) za zgradu kada stanar uveže upravnika.
              </p>
            </div>
            <Link
              href={`/registar/${id}/recenzija`}
              className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
            >
              Ostavi recenziju
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Prosečna ocena (objavljene)</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">{avg ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Broj recenzija</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">{list.length}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">ID u registru</div>
              <div className="mt-1 font-mono text-sm text-zinc-800">{row.id}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Objavljene recenzije</h2>
          <div className="mt-4 grid gap-3">
            {(reviews ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-900">Ocena: {r.rating_overall}/5</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString("sr-RS")}
                  </div>
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">{r.title ?? "Bez naslova"}</div>
                <div className="mt-1 text-sm text-zinc-700">{r.content ?? ""}</div>
                {repliesByReview.get(r.id)?.content ? (
                  <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                    <div className="text-xs font-medium text-zinc-600">Odgovor upravnika</div>
                    <div className="mt-1 whitespace-pre-wrap">{repliesByReview.get(r.id)!.content}</div>
                  </div>
                ) : null}
                <div className="mt-3">
                  <a
                    href={`/registar/${id}/prijavi-recenziju?review_id=${encodeURIComponent(r.id)}`}
                    className="text-xs font-medium text-zinc-900 underline underline-offset-4"
                  >
                    Prijavi recenziju
                  </a>
                </div>
              </div>
            ))}
            {!reviews?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Još nema objavljenih recenzija za ovaj zapis u registru.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
