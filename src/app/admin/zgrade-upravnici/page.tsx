import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/api";
import AdminAssignmentsClient from "./ui";

export default async function AdminAssignmentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "pending" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/zgrade-upravnici");
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const statusFilter = ["pending", "active", "ended", "rejected"].includes(status) ? status : "pending";
  const { data: rows } = await supabase
    .from("building_manager_assignments")
    .select(
      "id, building_id, manager_user_id, registry_id, status, source, start_date, end_date, proof_document_id, requested_by, created_at, buildings(street, street_number, entrance, city), professional_manager_registry(full_name, license_number)",
    )
    .eq("status", statusFilter)
    .order("created_at", { ascending: false })
    .limit(200);

  const userIds = Array.from(
    new Set((rows ?? []).flatMap((r) => [r.manager_user_id, r.requested_by]).filter(Boolean) as string[]),
  );
  const { data: people } = userIds.length
    ? await supabase.from("user_profiles").select("user_id, display_name").in("user_id", userIds)
    : { data: [] as { user_id: string; display_name: string | null }[] };
  const name = new Map((people ?? []).map((p) => [p.user_id, p.display_name ?? "—"]));

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl space-y-4">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">← Admin</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Upravnik ↔ zgrada</h1>
          <div className="mt-3 flex gap-2 text-xs">
            {[
              ["pending", "Na čekanju"],
              ["active", "Aktivne"],
              ["ended", "Završene"],
              ["rejected", "Odbijene"],
            ].map(([k, label]) => (
              <Link
                key={k}
                href={`/admin/zgrade-upravnici?status=${k}`}
                className={`rounded-full px-3 py-1 font-semibold ${statusFilter === k ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <AdminAssignmentsClient
            rows={(rows ?? []).map((r) => {
              const reg = r.professional_manager_registry as unknown as { full_name: string; license_number: string | null } | null;
              return {
                id: r.id,
                buildingId: r.building_id,
                address: formatAddress(r.buildings as unknown as Parameters<typeof formatAddress>[0]),
                manager: r.manager_user_id
                  ? `${name.get(r.manager_user_id) ?? "Upravnik"} (nalog)`
                  : `${reg?.full_name ?? "?"} (samo registar${reg?.license_number ? `, lic. ${reg.license_number}` : ""})`,
                source: r.source,
                requestedBy: r.requested_by ? name.get(r.requested_by) ?? null : null,
                status: r.status,
                startDate: r.start_date,
                proofDocumentId: r.proof_document_id,
                createdAt: r.created_at,
              };
            })}
          />
        </div>
      </main>
    </div>
  );
}
