import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ManagerPublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, municipality, city, professional_manager_status, user_type")
    .eq("user_id", id)
    .maybeSingle();

  if (!profile || profile.user_type !== "professional_manager") notFound();

  const { data: stats } = await supabase
    .from("manager_stats")
    .select("average_rating, review_count, active_buildings_count, historical_buildings_count, last_review_at")
    .eq("manager_user_id", id)
    .maybeSingle();

  const { data: reviews } = await supabase
    .from("manager_reviews")
    .select("id, rating_overall, title, content, created_at")
    .eq("manager_user_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(10);

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const { data: replies } = reviewIds.length
    ? await supabase
        .from("review_replies")
        .select("review_id, content, created_at, updated_at")
        .in("review_id", reviewIds)
    : { data: [] as any[] };

  const repliesByReview = new Map<string, any>();
  for (const rep of replies ?? []) repliesByReview.set(rep.review_id, rep);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                {profile.display_name ?? "Upravnik"}
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                {profile.city ?? ""} {profile.municipality ? `• ${profile.municipality}` : ""}
              </p>
              <div className="mt-3 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                Status: {profile.professional_manager_status}
              </div>
            </div>

            <Link
              href={`/upravnik/${id}/recenzija`}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Ostavi recenziju
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Prosečna ocena</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {stats?.average_rating ?? "-"}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Broj recenzija</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {stats?.review_count ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Aktivne zgrade</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {stats?.active_buildings_count ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Istorijske zgrade</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {stats?.historical_buildings_count ?? 0}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Najnovije recenzije
          </h2>
          <div className="mt-4 grid gap-3">
            {(reviews ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-900">
                    Ocena: {r.rating_overall}/5
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString("sr-RS")}
                  </div>
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">
                  {r.title ?? "Bez naslova"}
                </div>
                <div className="mt-1 text-sm text-zinc-700">{r.content ?? ""}</div>

                {repliesByReview.get(r.id)?.content ? (
                  <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                    <div className="text-xs font-medium text-zinc-600">
                      Odgovor upravnika
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">
                      {repliesByReview.get(r.id).content}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3">
                  <a
                    href={`/upravnik/${id}/prijavi-recenziju?review_id=${encodeURIComponent(
                      r.id,
                    )}`}
                    className="text-xs font-medium text-zinc-900 underline underline-offset-4"
                  >
                    Prijavi recenziju
                  </a>
                </div>
              </div>
            ))}
            {!reviews?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Nema objavljenih recenzija.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

