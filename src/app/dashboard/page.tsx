import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, membershipsRes] = await Promise.all([
    supabase.from("user_profiles").select("display_name, first_name, last_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("building_memberships")
      .select("id, building_id, role, verification_status, buildings(street, street_number, entrance, city)")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);

  const profile = profileRes.data;
  const memberships = membershipsRes.data;

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email?.split("@")[0] || "Korisnik";

  const initials = displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const STATUS: Record<string, { label: string; dot: string; pill: string }> = {
    verified:   { label: "Verifikovano",   dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
    pending:    { label: "Na čekanju",     dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
    unverified: { label: "Neverifikovano", dot: "bg-slate-300",   pill: "bg-slate-50 text-slate-600 ring-1 ring-slate-200" },
    rejected:   { label: "Odbijeno",       dot: "bg-red-500",     pill: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  };
  const ROLE: Record<string, string> = {
    resident: "Stanar", owner: "Vlasnik", tenant: "Zakupac",
    board_member: "Član saveta", manager: "Upravnik",
  };

  return (
    <div className="flex flex-1 flex-col" style={{ background: "#f7f8fa" }}>

      {/* ── Header bar ── */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
              style={{ background: "linear-gradient(135deg, #0f2744, #1a4a7a)" }}
            >
              {initials}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{displayName}</div>
              <div className="text-xs text-slate-400">{user.email}</div>
            </div>
          </div>
          <LogoutButton className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 space-y-8">

        {/* ── Moje zgrade ── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Moje zgrade</h2>
              <p className="mt-0.5 text-sm text-slate-500">Zgrade u kojima si registrovan</p>
            </div>
            <Link
              href="/dashboard/moje-zgrade/nova"
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm"
              style={{ background: "linear-gradient(135deg, #0f2744, #1a4a7a)" }}
            >
              + Dodaj zgradu
            </Link>
          </div>

          {!memberships?.length ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
              <div
                className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl text-4xl shadow-sm"
                style={{ background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)" }}
              >
                🏢
              </div>
              <h3 className="text-base font-bold text-slate-800">Još nisi u nijednoj zgradi</h3>
              <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
                Pronađi svoju adresu putem Mapbox pretrage i pridruži se.
              </p>
              <Link
                href="/dashboard/moje-zgrade/nova"
                className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow"
                style={{ background: "linear-gradient(135deg, #0f2744, #1a4a7a)" }}
              >
                Pronađi svoju zgradu →
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
              {memberships.map((m) => {
                const b = m.buildings as any;
                const addr = b ? `${b.street} ${b.street_number}${b.entrance ? `, ulaz ${b.entrance}` : ""}` : "Zgrada";
                const city = b?.city ?? "";
                const st = STATUS[m.verification_status] ?? STATUS.unverified;
                return (
                  <Link
                    key={m.id}
                    href={`/zgrade/${m.building_id}`}
                    className="group flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                      🏢
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-900 group-hover:text-brand-navy">
                        {addr}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        <span>{city}</span>
                        <span>·</span>
                        <span>{ROLE[m.role] ?? m.role}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${st.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
              <div className="px-5 py-3 bg-slate-50">
                <Link href="/dashboard/moje-zgrade" className="text-xs font-medium text-slate-500 hover:text-slate-800">
                  Pogledaj sve zgrade →
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ── Quick actions ── */}
        <section>
          <h2 className="mb-5 text-xl font-bold text-slate-900">Istraži</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: "🔍", title: "Pretraga upravnika",
                desc: "Državni registar, ocene, recenzije",
                href: "/pretraga",
                gradient: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                iconBg: "bg-blue-100",
              },
              {
                icon: "🗺️", title: "Mapa po radijusu",
                desc: "Upravnici u tvom kvartu",
                href: "/pretraga/mapa",
                gradient: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
                iconBg: "bg-violet-100",
              },
              {
                icon: "👤", title: "Moj profil",
                desc: "Nalog, telefon, adresa",
                href: "/dashboard/profil",
                gradient: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                iconBg: "bg-emerald-100",
              },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-200"
                style={{ background: a.gradient }}
              >
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${a.iconBg}`}>
                  {a.icon}
                </div>
                <div className="mt-4 font-bold text-slate-900">{a.title}</div>
                <div className="mt-1 text-xs text-slate-500">{a.desc}</div>
                <div className="mt-3 text-xs font-semibold text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                  Otvori →
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
