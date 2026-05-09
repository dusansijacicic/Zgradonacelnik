import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminReviewReportsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/prijave-recenzija");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: reports } = await supabase
    .from("review_reports")
    .select("id, review_id, reported_by, reason, details, status, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Prijave recenzija
          </h1>
          <div className="mt-6 grid gap-3">
            {(reports ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-900">
                    {r.reason} • {r.status}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleString("sr-RS")}
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  review_id: {r.review_id} • reported_by: {r.reported_by}
                </div>
                {r.details ? (
                  <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
                    {r.details}
                  </div>
                ) : null}
              </div>
            ))}
            {!reports?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Nema prijava.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

