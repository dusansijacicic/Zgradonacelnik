import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReviewClient from "./ui";

export default async function LeaveReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/upravnik/${encodeURIComponent(id)}/recenzija`);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Ostavi recenziju
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          MVP: forma za recenziju (više kriterijuma) + vezivanje za zgradu ako si
          verifikovan član te zgrade u relevantnom periodu.
        </p>
        <ReviewClient managerUserId={id} />
      </main>
    </div>
  );
}

