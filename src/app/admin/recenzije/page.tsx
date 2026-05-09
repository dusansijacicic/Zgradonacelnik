import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminReviewsClient from "./ui";

export default async function AdminReviewsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/recenzije");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: reviews } = await supabase
    .from("manager_reviews")
    .select("id, manager_user_id, reviewer_user_id, rating_overall, title, content, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Moderacija recenzija
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            MVP: publish/hide/remove.
          </p>
          <AdminReviewsClient reviews={reviews ?? []} />
        </div>
      </main>
    </div>
  );
}

