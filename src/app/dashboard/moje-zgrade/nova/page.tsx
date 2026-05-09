import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NewBuildingClient from "./ui";

export default async function NewBuildingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/moje-zgrade/nova");

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Dodaj zgradu
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          MVP: forma za unos adrese (city, municipality, street, number, entrance)
          + server-side normalizacija kroz `address_hash` u bazi (unique).
        </p>

        <NewBuildingClient />
      </main>
    </div>
  );
}

