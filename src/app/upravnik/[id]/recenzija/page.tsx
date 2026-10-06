import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReviewClient from "./ui";

export default async function LeaveReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ building_id?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const buildingId = sp.building_id?.match(/^[0-9a-f-]{36}$/i) ? sp.building_id : null;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/upravnik/${encodeURIComponent(id)}/recenzija`);

  const { data: manager } = await supabase.from("manager_public_profiles").select("display_name").eq("user_id", id).maybeSingle();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Recenzija: {manager?.display_name ?? "upravnik"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Ocenjuju potvrđeni stanari. Recenzija se objavljuje posle moderacije; upravnik može javno da odgovori.
          {buildingId ? " Recenzija će biti vezana za tvoju zgradu." : ""}
        </p>
        <ReviewClient managerUserId={id} buildingId={buildingId} />
      </main>
    </div>
  );
}
