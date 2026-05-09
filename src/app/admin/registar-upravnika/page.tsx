import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import RegistryImportClient from "./ui";

export default async function AdminRegistryImportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/registar-upravnika");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Import registra profesionalnih upravnika (CSV)
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            MVP: uvoz cele tabele iz <span className="font-mono text-xs">docs/solidus.csv</span> ili ručni
            CSV. Za nalepljeni fajl kolone:{" "}
            <span className="font-medium text-zinc-900">
              full_name, first_name, last_name, license_number, email, phone, municipality
            </span>
            . Solidus koristi kolone: Ime, Prezime, Mesto, Licenca br., Telefon, Email, Status…
          </p>

          <RegistryImportClient />
        </div>
      </main>
    </div>
  );
}

