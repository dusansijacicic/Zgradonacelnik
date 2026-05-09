import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReviewClient from "@/app/upravnik/[id]/recenzija/ui";

export default async function RegistryReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ building_id?: string }>;
}) {
  const { id: idRaw } = await params;
  const sp = await searchParams;
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id < 1) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?next=/registar/${encodeURIComponent(idRaw)}/recenzija${sp.building_id ? `?building_id=${encodeURIComponent(sp.building_id)}` : ""}`,
    );
  }

  const { data: row } = await supabase
    .from("professional_manager_registry")
    .select("id, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const buildingId = sp.building_id?.match(/^[0-9a-f-]{36}$/i) ? sp.building_id : undefined;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">
          <Link href={`/registar/${id}`} className="font-medium text-emerald-800 underline-offset-2 hover:underline">
            ← {row.full_name}
          </Link>
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">Ostavi recenziju</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Recenzija se vezuje za zapis u državnom registru
          {buildingId ? " i za zgradu čiji si verifikovan član (provera u bazi)." : "."} Ako nemaš{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs">building_id</code> u URL-u, šalješ opštu
          recenziju (isto pravilo kao za nalog na platformi bez zgrade).
        </p>
        <ReviewClient registryId={id} buildingId={buildingId ?? null} />
      </main>
    </div>
  );
}
