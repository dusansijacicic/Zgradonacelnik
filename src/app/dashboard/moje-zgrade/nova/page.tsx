import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewBuildingClient from "./ui";

export default async function NewBuildingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/moje-zgrade/nova");

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl">
        <div className="mb-4">
          <a href="/dashboard/moje-zgrade" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Moje zgrade
          </a>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Dodaj zgradu</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pretraži adresu svog objekta. Kad odabereš tačnu adresu, automatski se popunjuju koordinate.
          </p>
          <NewBuildingClient mapboxToken={mapboxToken} />
        </div>
      </main>
    </div>
  );
}
