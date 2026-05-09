import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReportReviewClient from "./ui";

export default async function ReportReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review_id?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const reviewId = sp.review_id;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(
      `/login?next=/upravnik/${encodeURIComponent(
        id,
      )}/prijavi-recenziju?review_id=${encodeURIComponent(reviewId ?? "")}`,
    );

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Prijava recenzije
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Ako smatraš da recenzija krši pravila, prijavi je admin timu.
        </p>

        <ReportReviewClient reviewId={reviewId ?? ""} managerId={id} />
      </main>
    </div>
  );
}

