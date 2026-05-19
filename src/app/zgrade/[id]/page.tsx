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
    .from("buildings").select("id, city, municipality, street, street_number, entrance, status")
    .eq("id", id).maybeSingle();
  if (!building) notFound();

  const [membershipResult, profileResult, premium] = await Promise.all([
    supabase.from("building_memberships").select("role, verification_status").eq("building_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("user_profiles").select("user_type, professional_manager_status, is_admin").eq("user_id", user.id).maybeSingle(),
    isBuildingPremium(supabase, id),
  ]);

  const membership = membershipResult.data;
  const profile = profileResult.data;

  const ROLE: Record<string, string> = { resident: "Stanar", owner: "Vlasnik", tenant: "Zakupac", board_member: "Član saveta", manager: "Upravnik" };
  const STATUS: Record<string, { label: string; cls: string }> = {
    verified:   { label: "Verifikovano",   cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
    pending:    { label: "Na čekanju",     cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
    unverified: { label: "Neverifikovano", cls: "bg-slate-50 text-slate-600 ring-1 ring-slate-200" },
    rejected:   { label: "Odbijeno",       cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  };

  const navItems = [
    { href: `/zgrade/${id}/oglasna-tabla`, icon: "📢", label: "Oglasna tabla",  desc: "Obaveštenja i poruke",         premium: false, color: "blue" },
    { href: `/zgrade/${id}/predlozi`,      icon: "🗳️", label: "Predlozi",       desc: "Glasanje o radovima",          premium: false, color: "violet" },
    { href: `/zgrade/${id}/zapisnici`,     icon: "📝", label: "Zapisnici",      desc: "Skupštine i odluke",           premium: true,  color: "emerald" },
    { href: `/zgrade/${id}/finansije`,     icon: "💰", label: "Finansije",      desc: "Prihodi i rashodi",            premium: true,  color: "emerald" },
    { href: `/zgrade/${id}/dokumenta`,     icon: "📁", label: "Dokumenta",      desc: "Ugovori i dokumenti",         premium: false, color: "orange" },
    { href: `/zgrade/${id}/pretplata`,     icon: "⭐", label: "Premium",        desc: "Status pretplate",            premium: false, color: "amber" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50", violet: "bg-violet-50", emerald: "bg-emerald-50",
    orange: "bg-orange-50", amber: "bg-amber-50",
  };

  return (
    <div className="flex flex-1 flex-col" style={{ background: "#f7f8fa" }}>

      {/* ── Building header ── */}
      <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/dashboard/moje-zgrade" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Moje zgrade
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {building.street} {building.street_number}
                {building.entrance ? <span className="font-normal text-slate-500">, ulaz {building.entrance}</span> : ""}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {building.city}{building.municipality ? ` · ${building.municipality}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {premium ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                  ⭐ Premium aktivan
                </span>
              ) : (
                <Link href={`/zgrade/${id}/pretplata`}
                  className="rounded-full border border-dashed border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50">
                  Aktiviraj Premium →
                </Link>
              )}
              {membership && (
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS[membership.verification_status]?.cls ?? STATUS.unverified.cls}`}>
                  {ROLE[membership.role] ?? membership.role} · {STATUS[membership.verification_status]?.label ?? membership.verification_status}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 space-y-6">

        {/* ── Nav grid ── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => {
            const locked = item.premium && !premium;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  locked ? "border-amber-100 hover:border-amber-200" : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${locked ? "bg-amber-50" : colorMap[item.color]}`}>
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{item.label}</span>
                    {locked && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        Premium
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{item.desc}</div>
                </div>
                <svg className="h-4 w-4 shrink-0 text-slate-200 transition group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            );
          })}
        </div>

        {/* ── Premium upsell ── */}
        {!premium && (
          <div
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5"
            style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)" }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <div className="font-bold text-amber-900">Premium — 500 RSD / mesec</div>
                <p className="mt-0.5 text-sm text-amber-800">Otključaj finansije, zapisnike i premium dokumenta za celu zgradu.</p>
              </div>
            </div>
            <Link href={`/zgrade/${id}/pretplata`}
              className="shrink-0 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-700">
              Saznaj više →
            </Link>
          </div>
        )}

        {/* ── Verifikacija nudge ── */}
        {membership?.verification_status === "unverified" && (
          <div
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5"
            style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)" }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <div className="font-bold text-blue-900">Verifikuj stanovanje</div>
                <p className="mt-0.5 text-sm text-blue-800">
                  Pošalji dokaz (ugovor, vlasnički list, komunalni račun) da admin potvrdi tvoje članstvo.
                </p>
              </div>
            </div>
            <Link href={`/zgrade/${id}/dokumenta`}
              className="shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700">
              Pošalji dokaz →
            </Link>
          </div>
        )}

        {/* ── Manager sekcija ── */}
        <AssignmentRequestClient
          buildingId={id}
          canRequest={profile?.user_type === "professional_manager" && profile?.professional_manager_status === "verified"}
        />
        {membership?.verification_status === "verified" && <RegistryManagerSuggestClient buildingId={id} />}

      </div>
    </div>
  );
}
