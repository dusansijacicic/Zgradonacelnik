import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MyBuildingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/moje-zgrade");

  const { data: memberships } = await supabase
    .from("building_memberships")
    .select("id, role, verification_status, building_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              Moje zgrade
            </h1>
            <Link
              href="/dashboard/moje-zgrade/nova"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Dodaj zgradu
            </Link>
          </div>

          <div className="mt-6 grid gap-3">
            {(memberships ?? []).map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="text-sm font-medium text-zinc-900">
                  Building: {m.building_id}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Role: {m.role} • Status: {m.verification_status}
                </div>
              </div>
            ))}

            {!memberships?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Još uvek nemaš nijednu zgradu.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

