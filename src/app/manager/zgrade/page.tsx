import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ManagerBuildingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/zgrade");

  const { data: assignments } = await supabase
    .from("building_manager_assignments")
    .select("id, building_id, status, start_date, end_date, created_at")
    .eq("manager_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Moje zgrade (upravnik)
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Zahtevi i aktivne veze upravnik–zgrada.
          </p>

          <div className="mt-6 grid gap-3">
            {(assignments ?? []).map((a) => (
              <div key={a.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="text-sm font-medium text-zinc-900">
                  Building: {a.building_id}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Status: {a.status} • {a.start_date ?? "—"} → {a.end_date ?? "—"}
                </div>
              </div>
            ))}
            {!assignments?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Nema zgrada još uvek.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

