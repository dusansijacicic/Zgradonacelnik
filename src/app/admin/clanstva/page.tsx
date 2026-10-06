import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/api";
import MembershipReviewList from "@/components/MembershipReviewList";

export default async function AdminMembershipsPage({ searchParams }: { searchParams: Promise<{ svi?: string }> }) {
  const { svi } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/clanstva");
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  let query = supabase
    .from("building_memberships")
    .select(
      "id, user_id, role, apartment_label, verification_status, proof_document_path, proof_note, proof_uploaded_at, buildings(street, street_number, entrance, city)",
    )
    .order("proof_uploaded_at", { ascending: false, nullsFirst: false })
    .limit(300);
  query = svi ? query.neq("verification_status", "verified") : query.eq("verification_status", "pending");
  const { data: members } = await query;

  const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
  const { data: names } = userIds.length
    ? await supabase.from("user_profiles").select("user_id, display_name").in("user_id", userIds)
    : { data: [] as { user_id: string; display_name: string | null }[] };
  const nameById = new Map((names ?? []).map((n) => [n.user_id, n.display_name ?? "Korisnik"]));

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl space-y-4">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">← Admin</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Potvrde stanara</h1>
            <Link href={svi ? "/admin/clanstva" : "/admin/clanstva?svi=1"} className="text-xs font-semibold underline">
              {svi ? "Samo sa dokazom" : "Prikaži i one bez dokaza"}
            </Link>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Kad zgrada ima aktivnog upravnika, on potvrđuje stanare. Ovde su svi zahtevi (i za zgrade bez upravnika).
          </p>
          <div className="mt-5">
            <MembershipReviewList
              rows={(members ?? []).map((m) => ({
                id: m.id,
                name: nameById.get(m.user_id) ?? "Korisnik",
                address: formatAddress(m.buildings as unknown as Parameters<typeof formatAddress>[0]),
                role: m.role,
                apartment: m.apartment_label,
                status: m.verification_status,
                hasProof: Boolean(m.proof_document_path),
                note: m.proof_note,
                proofUploadedAt: m.proof_uploaded_at,
              }))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
