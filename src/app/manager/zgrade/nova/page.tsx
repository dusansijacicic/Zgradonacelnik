import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ManagerNewBuildingClient from "./ui";

export default async function ManagerNewBuildingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/zgrade/nova");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type, professional_manager_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.user_type !== "professional_manager" || profile.professional_manager_status !== "verified") {
    redirect("/manager/verifikacija");
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl space-y-4">
        <Link href="/manager/zgrade" className="text-sm text-zinc-500 hover:text-zinc-800">← Moje zgrade</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Dodaj zgradu kojom upravljaš</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Izaberi adresu i priloži dokaz ovlašćenja (ugovor sa stambenom zajednicom ili odluku skupštine /
            rešenje o postavljenju). Posle provere zgrada se pojavljuje u tvom profilu i stanari mogu da te ocenjuju.
          </p>
          <ManagerNewBuildingClient />
        </div>
      </main>
    </div>
  );
}
