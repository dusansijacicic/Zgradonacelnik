import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("building_memberships")
    .select("id, verification_status, buildings(street, street_number, city)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl space-y-6">

        {/* Pozdrav */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Dashboard</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
                Zdravo, {displayName}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
            </div>
            <LogoutButton className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50" />
          </div>
        </div>

        {/* Moje zgrade */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900">Moje zgrade</h2>
            <Link
              href="/dashboard/moje-zgrade/nova"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-700"
            >
              + Dodaj zgradu
            </Link>
          </div>

          {!memberships?.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
              <p className="text-sm font-medium text-zinc-700">Još nisi u nijednoj zgradi</p>
              <p className="mt-1 text-xs text-zinc-500">
                Unesi adresu svoje zgrade i podnesi zahtev za verifikaciju.
              </p>
              <Link
                href="/dashboard/moje-zgrade/nova"
                className="mt-4 inline-flex items-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Dodaj svoju zgradu →
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {memberships.map((m) => {
                const b = m.buildings as any;
                const addr = b ? `${b.street} ${b.street_number}, ${b.city}` : "Zgrada";
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-900">{addr}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      m.verification_status === "verified" ? "bg-emerald-100 text-emerald-800" :
                      m.verification_status === "pending" ? "bg-amber-100 text-amber-800" :
                      "bg-zinc-100 text-zinc-600"
                    }`}>
                      {m.verification_status === "verified" ? "Verifikovano" :
                       m.verification_status === "pending" ? "Na čekanju" : "Neverifikovano"}
                    </span>
                  </div>
                );
              })}
              <Link
                href="/dashboard/moje-zgrade"
                className="mt-1 block text-center text-xs font-medium text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
              >
                Sve moje zgrade →
              </Link>
            </div>
          )}
        </div>

        {/* Brze akcije */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/pretraga"
            className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 shadow-sm"
          >
            <div className="text-lg">🔍</div>
            <div className="mt-2 font-semibold">Pretraga upravnika</div>
            <div className="mt-0.5 text-xs text-zinc-500">Državni registar i platforma</div>
          </Link>
          <Link
            href="/pretraga/mapa"
            className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 shadow-sm"
          >
            <div className="text-lg">🗺️</div>
            <div className="mt-2 font-semibold">Mapa upravnika</div>
            <div className="mt-0.5 text-xs text-zinc-500">Pretraga po radijusu od lokacije</div>
          </Link>
          <Link
            href="/dashboard/profil"
            className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 shadow-sm"
          >
            <div className="text-lg">👤</div>
            <div className="mt-2 font-semibold">Moj profil</div>
            <div className="mt-0.5 text-xs text-zinc-500">Nalog, telefon, adresa</div>
          </Link>
        </div>

      </main>
    </div>
  );
}
