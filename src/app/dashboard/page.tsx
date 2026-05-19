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
    .select("id, building_id, role, verification_status, buildings(street, street_number, entrance, city)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email?.split("@")[0];

  const initials = displayName
    ? displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    verified:   { label: "Verifikovano",   cls: "bg-emerald-100 text-emerald-800" },
    pending:    { label: "Na čekanju",     cls: "bg-amber-100 text-amber-800" },
    unverified: { label: "Neverifikovano", cls: "bg-zinc-100 text-zinc-600" },
    rejected:   { label: "Odbijeno",       cls: "bg-red-100 text-red-700" },
  };

  const ROLE_MAP: Record<string, string> = {
    resident: "Stanar", owner: "Vlasnik", tenant: "Zakupac",
    board_member: "Član saveta", manager: "Upravnik",
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      {/* Top bar */}
      <div className="bg-white border-b border-zinc-200 px-4 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-sm font-bold text-white">
              {initials}
            </div>
            <div>
              <div className="font-semibold text-zinc-900">{displayName}</div>
              <div className="text-xs text-zinc-400">{user.email}</div>
            </div>
          </div>
          <LogoutButton className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">

        {/* Moje zgrade */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900">Moje zgrade</h2>
            <Link
              href="/dashboard/moje-zgrade/nova"
              className="flex items-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2 text-xs font-semibold text-white hover:bg-brand-navy-deep"
            >
              <span className="text-base leading-none">+</span> Dodaj zgradu
            </Link>
          </div>

          {!memberships?.length ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-3xl">
                🏢
              </div>
              <h3 className="font-semibold text-zinc-800">Još nisi u nijednoj zgradi</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Traži svoju adresu i pridruži se — ili registruj zgradu ako je prva na platformi.
              </p>
              <Link
                href="/dashboard/moje-zgrade/nova"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-6 py-3 text-sm font-semibold text-white hover:bg-brand-navy-deep"
              >
                Pronađi svoju zgradu →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {memberships.map((m) => {
                const b = m.buildings as any;
                const addr = b
                  ? `${b.street} ${b.street_number}${b.entrance ? `, ulaz ${b.entrance}` : ""}`
                  : "Zgrada";
                const city = b?.city ?? "";
                const st = STATUS_MAP[m.verification_status] ?? { label: m.verification_status, cls: "bg-zinc-100 text-zinc-600" };

                return (
                  <Link
                    key={m.id}
                    href={`/zgrade/${m.building_id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-brand-sky/40 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-sky-muted text-xl">
                        🏢
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-zinc-900">{addr}</div>
                        <div className="text-xs text-zinc-400">{city} • {ROLE_MAP[m.role] ?? m.role}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className="text-zinc-300">›</span>
                    </div>
                  </Link>
                );
              })}

              {(memberships?.length ?? 0) >= 5 && (
                <Link
                  href="/dashboard/moje-zgrade"
                  className="block text-center text-sm font-medium text-brand-navy hover:underline py-2"
                >
                  Pogledaj sve zgrade →
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Brze akcije */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-zinc-900">Brze akcije</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🔍", title: "Pretraga upravnika", desc: "Državni registar i platformski profili", href: "/pretraga", color: "hover:border-blue-200 hover:bg-blue-50/50" },
              { icon: "🗺️", title: "Mapa po radijusu", desc: "Nađi upravnike u svom kvartu", href: "/pretraga/mapa", color: "hover:border-violet-200 hover:bg-violet-50/50" },
              { icon: "👤", title: "Moj profil", desc: "Nalog, telefon i adresa", href: "/dashboard/profil", color: "hover:border-zinc-300 hover:bg-zinc-50" },
            ].map((a) => (
              <Link
                key={a.title}
                href={a.href}
                className={`rounded-2xl border border-zinc-200 bg-white p-5 transition ${a.color}`}
              >
                <div className="text-2xl">{a.icon}</div>
                <div className="mt-3 font-semibold text-zinc-900">{a.title}</div>
                <div className="mt-1 text-xs text-zinc-500">{a.desc}</div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
