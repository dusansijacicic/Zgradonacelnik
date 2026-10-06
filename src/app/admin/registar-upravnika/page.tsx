import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import RegistryImportClient from "./ui";

export default async function AdminRegistryImportPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/registar-upravnika");
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const head = { count: "exact" as const, head: true };
  const [total, active, claimed, lastSync] = await Promise.all([
    supabase.from("professional_manager_registry").select("id", head),
    supabase.from("professional_manager_registry").select("id", head).eq("is_active", true),
    supabase.from("user_profiles").select("user_id", head).not("registry_id", "is", null),
    supabase
      .from("audit_log")
      .select("created_at, metadata")
      .eq("action", "registry_sync")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stats = [
    { label: "Ukupno u bazi", value: total.count ?? 0 },
    { label: "Aktivni (Registrovan)", value: active.count ?? 0 },
    { label: "Neaktivni / obrisani", value: (total.count ?? 0) - (active.count ?? 0) },
    { label: "Preuzeli nalog", value: claimed.count ?? 0 },
  ];

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl space-y-4">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">← Admin</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Registar profesionalnih upravnika</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Sinhronizacija sa izvozom iz PKS registra. Redovi se nikad ne brišu: ključ je broj licence, izmene se
            ažuriraju, a upravnici kojih više nema (ili su „Obrisan iz registra“) postaju neaktivni i gube status
            verifikovanog upravnika. Recenzije i istorija ostaju.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500">{s.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{s.value}</div>
              </div>
            ))}
          </div>
          {lastSync.data ? (
            <p className="mt-3 text-xs text-zinc-500">
              Poslednja sinhronizacija: {new Date(lastSync.data.created_at).toLocaleString("sr-RS")}
            </p>
          ) : null}
          <RegistryImportClient />
          <div className="mt-6 border-t border-zinc-100 pt-4 text-sm">
            <Link href="/admin/pozivi-upravnicima" className="font-semibold text-brand-navy underline">
              Pošalji pozive upravnicima iz registra →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
