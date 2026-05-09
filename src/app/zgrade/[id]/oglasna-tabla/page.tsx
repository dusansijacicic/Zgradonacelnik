import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AnnouncementClient from "./ui";

export default async function BuildingAnnouncementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/oglasna-tabla`);

  const { data: announcements } = await supabase
    .from("building_announcements")
    .select("id, title, content, pinned, visibility, created_at")
    .eq("building_id", id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Oglasna tabla
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Objave za stanare (i opcionalno javne objave).
          </p>

          <AnnouncementClient buildingId={id} initial={announcements ?? []} />
        </div>
      </main>
    </div>
  );
}

