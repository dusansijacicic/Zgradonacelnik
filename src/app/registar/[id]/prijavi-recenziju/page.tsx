import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReportReviewClient from "@/app/upravnik/[id]/prijavi-recenziju/ui";

export default async function RegistryReportReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review_id?: string }>;
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
      `/login?next=/registar/${encodeURIComponent(idRaw)}/prijavi-recenziju?review_id=${encodeURIComponent(sp.review_id ?? "")}`,
    );
  }

  const { data: row } = await supabase
    .from("professional_manager_registry")
    .select("id, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">
          <Link href={`/registar/${id}`} className="font-medium text-emerald-800 underline-offset-2 hover:underline">
            ← {row.full_name}
          </Link>
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">Prijava recenzije</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Ako smatraš da recenzija krši pravila, prijavi je admin timu.
        </p>
        <ReportReviewClient
          reviewId={sp.review_id ?? ""}
          profileBackHref={`/registar/${id}`}
          profileBackLabel="profil u registru"
        />
      </main>
    </div>
  );
}
