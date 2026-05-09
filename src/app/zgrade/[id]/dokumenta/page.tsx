import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DocumentsClient from "./ui";

export default async function BuildingDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/dokumenta`);

  const { data: docs } = await supabase
    .from("building_documents")
    .select("id, document_type, title, file_name, file_size, visibility, created_at")
    .eq("building_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Dokumenta
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Preuzimanje ide preko signed URL (10 minuta važenja).
          </p>

          <DocumentsClient buildingId={id} initial={docs ?? []} />
        </div>
      </main>
    </div>
  );
}

