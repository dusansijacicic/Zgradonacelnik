import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ManagerReviewReplyClient from "./ui";

export default async function ManagerReviewsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/recenzije");

  const { data: reviews } = await supabase
    .from("manager_reviews")
    .select(
      "id, rating_overall, title, content, status, created_at, reviewer_user_id, building_id",
    )
    .eq("manager_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const { data: replies } = reviewIds.length
    ? await supabase
        .from("review_replies")
        .select("id, review_id, content, created_at, updated_at")
        .in("review_id", reviewIds)
    : { data: [] as any[] };

  const repliesByReview = new Map<string, any>();
  for (const rep of replies ?? []) repliesByReview.set(rep.review_id, rep);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Recenzije o tebi
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            MVP: odgovor na recenziju i moderacija kroz admin panel.
          </p>

          <div className="mt-6 grid gap-3">
            {(reviews ?? []).map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-900">
                    Ocena: {r.rating_overall}/5
                  </div>
                  <div className="text-xs text-zinc-500">{r.status}</div>
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">
                  {r.title ?? "Bez naslova"}
                </div>
                <div className="mt-1 text-sm text-zinc-700">
                  {r.content ?? ""}
                </div>

                <div className="mt-4">
                  <ManagerReviewReplyClient
                    reviewId={r.id}
                    existing={repliesByReview.get(r.id)?.content ?? ""}
                  />
                </div>
              </div>
            ))}

            {!reviews?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Nema recenzija još uvek.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

