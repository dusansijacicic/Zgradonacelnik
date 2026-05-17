import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  proposal_id: z.string().uuid(),
  vote: z.enum(["for", "against", "abstain"]),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Nevalidni podaci" }, { status: 400 });
  }

  const { proposal_id, vote } = body.data;

  const { error } = await supabase.from("proposal_votes").upsert(
    { proposal_id, user_id: user.id, vote },
    { onConflict: "proposal_id,user_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Vrati ažurirani tally
  const { data: tally } = await supabase
    .from("proposal_votes")
    .select("vote")
    .eq("proposal_id", proposal_id);

  const counts = { for: 0, against: 0, abstain: 0 };
  for (const v of tally ?? []) {
    if (v.vote in counts) counts[v.vote as keyof typeof counts]++;
  }

  return NextResponse.json({ ok: true, counts });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposal_id } = (await request.json()) as { proposal_id?: string };
  if (!proposal_id) return NextResponse.json({ error: "proposal_id required" }, { status: 400 });

  await supabase
    .from("proposal_votes")
    .delete()
    .eq("proposal_id", proposal_id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
