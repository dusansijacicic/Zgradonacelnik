import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Profil
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          U MVP-u ovde ide onboarding (ime, prezime, prikazano ime, tip korisnika,
          telefon/opština opciono).
        </p>
        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <div className="font-medium text-zinc-900">Supabase user</div>
          <div className="mt-1 text-zinc-700 break-all">{user.id}</div>
          <div className="mt-1 text-zinc-700 break-all">{user.email}</div>
        </div>
      </main>
    </div>
  );
}

