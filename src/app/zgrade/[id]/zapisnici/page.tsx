import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBuildingPremium } from "@/lib/buildingPremium";
import ZapisniciClient from "./ui";

export default async function MeetingMinutesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/zapisnici`);

  const premium = await isBuildingPremium(supabase, id);

  if (!premium) {
    return (
      <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
        <main className="w-full max-w-5xl">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
              ★
            </div>
            <h1 className="text-xl font-semibold text-zinc-900">Zapisnici — Premium funkcija</h1>
            <p className="mt-2 text-sm text-zinc-600 max-w-md mx-auto">
              Zapisnici sa sastanaka stanara dostupni su samo Premium zgradama.
            </p>
            <Link
              href={`/zgrade/${id}/pretplata`}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Aktivirajte Premium — 500 RSD/mes.
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { data: minutes } = await supabase
    .from("meeting_minutes")
    .select("id, title, held_at, location, agenda, decisions, attendees_count, created_at")
    .eq("building_id", id)
    .order("held_at", { ascending: false })
    .limit(50);

  const { data: assignment } = await supabase
    .from("building_manager_assignments")
    .select("id")
    .eq("building_id", id)
    .eq("manager_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Zapisnici sa sastanaka</h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Premium
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Transparentna istorija odluka stambene zajednice.
          </p>
          <ZapisniciClient
            buildingId={id}
            initial={minutes ?? []}
            isManager={!!assignment}
          />
        </div>
      </main>
    </div>
  );
}
