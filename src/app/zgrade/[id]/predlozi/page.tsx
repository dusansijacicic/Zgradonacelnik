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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/predlozi`);

  const { data: proposals } = await supabase
    .from("building_proposals")
    .select(`
      id, title, description, category, status, priority, estimated_cost, created_at,
      proposal_votes ( vote )
    `)
    .eq("building_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Enrich with vote counts and user's own vote
  const { data: myVotes } = await supabase
    .from("proposal_votes")
    .select("proposal_id, vote")
    .eq("user_id", user.id)
    .in("proposal_id", (proposals ?? []).map((p) => p.id));

  const myVoteMap = Object.fromEntries((myVotes ?? []).map((v) => [v.proposal_id, v.vote]));

  const enriched = (proposals ?? []).map((p) => {
    const votes = (p.proposal_votes ?? []) as { vote: string }[];
    const counts = { for: 0, against: 0, abstain: 0 };
    for (const v of votes) {
      if (v.vote in counts) counts[v.vote as keyof typeof counts]++;
    }
    return { ...p, vote_counts: counts, my_vote: myVoteMap[p.id] ?? null };
  });

  const { data: membership } = await supabase
    .from("building_memberships")
    .select("role, verification_status")
    .eq("building_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isVerifiedMember = membership?.verification_status === "verified";

  const { data: managerAssignment } = await supabase
    .from("building_manager_assignments")
    .select("id")
    .eq("building_id", id)
    .eq("manager_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Predlozi radova</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Stanari predlažu, glasaju, upravnik menja status.
          </p>
          <ProposalsClient
            buildingId={id}
            initial={enriched as any}
            canCreate={isVerifiedMember}
            isManager={!!managerAssignment}
          />
        </div>
      </main>
    </div>
  );
}
