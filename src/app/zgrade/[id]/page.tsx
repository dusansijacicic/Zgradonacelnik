import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBuildingPremium } from "@/lib/buildingPremium";
import AssignmentRequestClient from "./ui";
import RegistryManagerSuggestClient from "./suggest-registry-ui";

export default async function BuildingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}`);

  const { data: building } = await supabase
    .from("buildings")
    .select("id, city, municipality, street, street_number, entrance, status")
    .eq("id", id)
    .maybeSingle();

  if (!building) notFound();

  const [membershipResult, profileResult, premium] = await Promise.all([
    supabase.from("building_memberships")
      .select("role, verification_status")
      .eq("building_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("user_profiles")
      .select("user_type, professional_manager_status, is_admin")
      .eq("user_id", user.id).maybeSingle(),
    isBuildingPremium(supabase, id),
  ]);

  const membership = membershipResult.data;
  const profile = profileResult.data;

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    verified:   { label: "Verifikovano",   cls: "bg-emerald-100 text-emerald-800" },
    pending:    { label: "Na čekanju",     cls: "bg-amber-100 text-amber-700" },
    unverified: { label: "Neverifikovano", cls: "bg-zinc-100 text-zinc-600" },
    rejected:   { label: "Odbijeno",       cls: "bg-red-100 text-red-700" },
  };
  const ROLE_MAP: Record<string, string> = {
    resident: "Stanar", owner: "Vlasnik", tenant: "Zakupac",
    board_member: "Član saveta", manager: "Upravnik",
  };

  const ms = membership ? STATUS_MAP[membership.verification_status] : null;

  const navItems = [
    { href: `/zgrade/${id}/oglasna-tabla`, icon: "📢", label: "Oglasna tabla", desc: "Obaveštenja i važne poruke", premium: false },
    { href: `/zgrade/${id}/predlozi`,      icon: "🗳️", label: "Predlozi",      desc: "Glasanje o radovima",       premium: false },
    { href: `/zgrade/${id}/zapisnici`,     icon: "📝", label: "Zapisnici",     desc: "Skupštine i odluke",        premium: true  },
    { href: `/zgrade/${id}/finansije`,     icon: "💰", label: "Finansije",     desc: "Prihodi i rashodi",         premium: true  },
    { href: `/zgrade/${id}/dokumenta`,     icon: "📁", label: "Dokumenta",     desc: "Ugovori i dokumenti",       premium: false },
    { href: `/zgrade/${id}/pretplata`,     icon: "⭐", label: "Premium",       desc: "Status pretplate",          premium: false },
  ];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      {/* Building header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Link href="/dashboard/moje-zgrade" className="text-xs text-zinc-400 hover:text-zinc-600">
                ← Moje zgrade
              </Link>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                {building.street} {building.street_number}
                {building.entrance ? `, ulaz ${building.entrance}` : ""}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {building.city}{building.municipality ? ` · ${building.municipality}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {premium ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                  ⭐ Premium
                </span>
              ) : (
                <Link
                  href={`/zgrade/${id}/pretplata`}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Aktiviraj Premium →
                </Link>
              )}
              {ms && (
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${ms.cls}`}>
                  {membership && ROLE_MAP[membership.role] ? `${ROLE_MAP[membership.role]} · ` : ""}{ms.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">

        {/* Navigation grid */}
        <section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {navItems.map((item) => {
              const locked = item.premium && !premium;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-4 rounded-2xl border p-4 transition ${
                    locked
                      ? "border-amber-100 bg-amber-50/50 hover:bg-amber-50"
                      : "border-zinc-200 bg-white hover:border-brand-sky/40 hover:shadow-sm"
                  }`}
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                    locked ? "bg-amber-100" : "bg-zinc-100"
                  }`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-semibold text-sm ${locked ? "text-amber-800" : "text-zinc-900"}`}>
                      {item.label}
                      {locked && <span className="ml-1.5 text-xs font-normal text-amber-600">Premium</span>}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">{item.desc}</div>
                  </div>
                  <span className={`ml-auto text-lg ${locked ? "text-amber-300" : "text-zinc-200 group-hover:text-zinc-400"}`}>›</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Premium upsell */}
        {!premium && (
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⭐</span>
                  <span className="font-bold text-amber-900">Aktiviraj Premium za 500 RSD/mes.</span>
                </div>
                <p className="mt-1 text-sm text-amber-800">
                  Otključaj finansije, zapisnike i premium dokumenta za celu zgradu.
                </p>
              </div>
              <Link
                href={`/zgrade/${id}/pretplata`}
                className="shrink-0 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Saznaj više →
              </Link>
            </div>
          </section>
        )}

        {/* Verifikacija stanara */}
        {membership && membership.verification_status === "unverified" && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-xl">ℹ️</span>
              <div>
                <div className="font-semibold text-blue-900">Verifikuj stanovanje</div>
                <p className="mt-1 text-sm text-blue-800">
                  Pošalji dokaz stanovanja (ugovor o kupovini, vlasnički list, račun za komunalije) da admin potvrdi tvoje članstvo.
                </p>
                <Link
                  href={`/zgrade/${id}/dokumenta`}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Pošalji dokaz →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Manager sekcija */}
        <section>
          <AssignmentRequestClient
            buildingId={id}
            canRequest={
              profile?.user_type === "professional_manager" &&
              profile?.professional_manager_status === "verified"
            }
          />
          {membership?.verification_status === "verified" ? (
            <RegistryManagerSuggestClient buildingId={id} />
          ) : null}
        </section>

      </div>
    </div>
  );
}
