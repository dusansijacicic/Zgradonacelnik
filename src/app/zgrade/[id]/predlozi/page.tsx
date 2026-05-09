import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProposalsClient from "./ui";

export default async function BuildingProposalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/predlozi`);

  const { data: proposals } = await supabase
    .from("building_proposals")
    .select("id, title, description, category, status, priority, estimated_cost, created_at")
    .eq("building_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Predlozi radova
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Stanari predlažu radove, upravnik menja status.
          </p>
          <ProposalsClient buildingId={id} initial={proposals ?? []} />
        </div>
      </main>
    </div>
  );
}

