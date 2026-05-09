import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminAssignmentsClient from "./ui";

export default async function AdminAssignmentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/zgrade-upravnici");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: rows } = await supabase
    .from("building_manager_assignments")
    .select("id, building_id, manager_user_id, status, start_date, end_date, proof_document_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-6xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Upravnik ↔ zgrada (odobravanja)
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Pending zahtevi i aktivne/ended veze.
          </p>
          <AdminAssignmentsClient rows={rows ?? []} />
        </div>
      </main>
    </div>
  );
}

