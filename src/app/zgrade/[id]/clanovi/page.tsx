import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import MembershipReviewList from "@/components/MembershipReviewList";

/** Upravnik zgrade (ili admin) potvrđuje ko stvarno stanuje u zgradi. */
export default async function BuildingMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${id}/clanovi`);

  const [{ data: isMgr }, { data: profile }] = await Promise.all([
    supabase.rpc("is_active_manager", { building: id }),
    supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!isMgr && !profile?.is_admin) redirect(`/zgrade/${id}`);

  const { data: members } = await supabase
    .from("building_memberships")
    .select("id, user_id, role, apartment_label, verification_status, proof_document_path, proof_note, proof_uploaded_at")
    .eq("building_id", id)
    .neq("user_id", user.id)
    .order("verification_status", { ascending: true })
    .limit(500);

  // Imena članova (user_profiles je inače privatan) — samo za ovlašćenog upravnika/admina.
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: names } = userIds.length
    ? await createSupabaseAdminClient().from("user_profiles").select("user_id, display_name").in("user_id", userIds)
    : { data: [] as { user_id: string; display_name: string | null }[] };
  const nameById = new Map((names ?? []).map((n) => [n.user_id, n.display_name ?? "Korisnik"]));

  const order: Record<string, number> = { pending: 0, unverified: 1, rejected: 2, verified: 3 };
  const rows = (members ?? [])
    .map((m) => ({
      id: m.id,
      name: nameById.get(m.user_id) ?? "Korisnik",
      role: m.role,
      apartment: m.apartment_label,
      status: m.verification_status,
      hasProof: Boolean(m.proof_document_path),
      note: m.proof_note,
      proofUploadedAt: m.proof_uploaded_at,
    }))
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl space-y-4">
        <Link href={`/zgrade/${id}`} className="text-sm text-zinc-500 hover:text-zinc-800">← Nazad na zgradu</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Članovi zgrade</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Potvrdi stanare koje poznaješ ili čiji je dokaz ispravan. Samo potvrđeni stanari glasaju, vide finansije i
            ocenjuju upravnika.
          </p>
          <div className="mt-5">
            <MembershipReviewList rows={rows} />
          </div>
        </div>
      </main>
    </div>
  );
}
