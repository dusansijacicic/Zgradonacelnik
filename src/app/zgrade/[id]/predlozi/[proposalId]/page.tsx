import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProposalCommentsClient from "./ui";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const { id, proposalId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(
      `/login?next=/zgrade/${encodeURIComponent(id)}/predlozi/${encodeURIComponent(proposalId)}`,
    );

  const { data: proposal } = await supabase
    .from("building_proposals")
    .select("id, building_id, title, description, category, status, priority, estimated_cost, created_at")
    .eq("id", proposalId)
    .eq("building_id", id)
    .maybeSingle();

  if (!proposal) notFound();

  const { data: comments } = await supabase
    .from("proposal_comments")
    .select("id, content, user_id, created_at")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: true })
    .limit(300);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                {proposal.title}
              </h1>
              <div className="mt-2 text-xs text-zinc-500">
                {proposal.category} • {proposal.priority} • {proposal.status} •{" "}
                {new Date(proposal.created_at).toLocaleString("sr-RS")}
              </div>
            </div>
            <Link
              href={`/zgrade/${id}/predlozi`}
              className="text-sm font-medium text-zinc-900 underline underline-offset-4"
            >
              Nazad →
            </Link>
          </div>

          <div className="mt-4 text-sm text-zinc-700 whitespace-pre-wrap">
            {proposal.description}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Komentari
          </h2>
          <ProposalCommentsClient proposalId={proposalId} initial={comments ?? []} />
        </div>
      </main>
    </div>
  );
}

