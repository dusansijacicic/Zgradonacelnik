import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBuildingPremium } from "@/lib/buildingPremium";
import AssignmentRequestClient from "./ui";
import RegistryManagerSuggestClient from "./suggest-registry-ui";
import ProofUploadClient from "./proof-ui";
import JoinBuildingClient from "./join-ui";
import { OfferForm } from "@/app/manager/ponude/ui";

const ROLE: Record<string, string> = { resident: "Član domaćinstva", owner: "Vlasnik", tenant: "Zakupac", board_member: "Član saveta", manager: "Upravnik" };
const STATUS: Record<string, { label: string; cls: string }> = {
  verified: { label: "Verifikovano", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  pending: { label: "Dokaz na proveri", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  unverified: { label: "Neverifikovano", cls: "bg-slate-50 text-slate-600 ring-1 ring-slate-200" },
  rejected: { label: "Dokaz odbijen", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
};

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

  const [{ data: memberships }, { data: profile }, premium, { data: assignments }, { data: offers }] = await Promise.all([
    supabase.from("building_memberships").select("id, role, verification_status").eq("building_id", id).eq("user_id", user.id),
    supabase.from("user_profiles").select("user_type, professional_manager_status, is_admin").eq("user_id", user.id).maybeSingle(),
    isBuildingPremium(supabase, id),
    supabase
      .from("building_manager_assignments")
      .select("id, status, manager_user_id, registry_id, start_date, requested_by")
      .eq("building_id", id)
      .in("status", ["active", "pending"]),
    supabase
      .from("manager_offers")
      .select("id, manager_user_id, message, price_monthly_rsd, contact_email, contact_phone, created_at")
      .eq("building_id", id)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const membership =
    (memberships ?? []).find((m) => m.verification_status === "verified") ?? (memberships ?? [])[0] ?? null;
  const isVerifiedManager = profile?.user_type === "professional_manager" && profile.professional_manager_status === "verified";
  const active = (assignments ?? []).filter((a) => a.status === "active");
  const pending = (assignments ?? []).filter((a) => a.status === "pending");
  const iAmManager = active.some((a) => a.manager_user_id === user.id);
  const iRequested = pending.some((a) => a.manager_user_id === user.id);
  const canModerate = iAmManager || Boolean(profile?.is_admin);

  // Imena upravnika: javni profili (nalog) ili registar (bez naloga).
  const userIds = Array.from(
    new Set([...(assignments ?? []).map((a) => a.manager_user_id), ...(offers ?? []).map((o) => o.manager_user_id)].filter(Boolean) as string[]),
  );
  const registryIds = Array.from(new Set((assignments ?? []).map((a) => a.registry_id).filter(Boolean) as number[]));
  const [{ data: managerProfiles }, { data: registryRows }, { data: stats }] = await Promise.all([
    userIds.length
      ? supabase.from("manager_public_profiles").select("user_id, display_name").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
    registryIds.length
      ? supabase.from("professional_manager_registry").select("id, full_name").in("id", registryIds)
      : Promise.resolve({ data: [] as { id: number; full_name: string }[] }),
    userIds.length
      ? supabase.from("manager_stats").select("manager_user_id, average_rating, review_count").in("manager_user_id", userIds)
      : Promise.resolve({ data: [] as { manager_user_id: string; average_rating: number | null; review_count: number }[] }),
  ]);
  const nameByUser = new Map((managerProfiles ?? []).map((p) => [p.user_id, p.display_name]));
  const nameByRegistry = new Map((registryRows ?? []).map((r) => [r.id, r.full_name]));
  const statsByUser = new Map((stats ?? []).map((s) => [s.manager_user_id, s]));

  const managerLink = (a: { manager_user_id: string | null; registry_id: number | null }) =>
    a.manager_user_id ? `/upravnik/${a.manager_user_id}` : `/registar/${a.registry_id}`;
  const managerName = (a: { manager_user_id: string | null; registry_id: number | null }) =>
    (a.manager_user_id && nameByUser.get(a.manager_user_id)) || (a.registry_id && nameByRegistry.get(a.registry_id)) || "Upravnik";

  const navItems = [
    { href: `/zgrade/${id}/oglasna-tabla`, icon: "📢", label: "Oglasna tabla", desc: "Obaveštenja", premium: false },
    { href: `/zgrade/${id}/predlozi`, icon: "🗳️", label: "Predlozi", desc: "Glasanje o radovima", premium: true },
    { href: `/zgrade/${id}/zapisnici`, icon: "📝", label: "Zapisnici", desc: "Skupštine i odluke", premium: true },
    { href: `/zgrade/${id}/finansije`, icon: "💰", label: "Finansije", desc: "Prihodi i rashodi", premium: true },
    { href: `/zgrade/${id}/dokumenta`, icon: "📁", label: "Dokumenta", desc: "Ugovori i dokumenti", premium: false },
    { href: `/zgrade/${id}/pretplata`, icon: "⭐", label: "Premium", desc: "Status pretplate", premium: false },
  ];

  return (
    <div className="flex flex-1 flex-col" style={{ background: "#f7f8fa" }}>
      <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/dashboard/moje-zgrade" className="text-xs text-slate-400 hover:text-slate-700">← Moje zgrade</Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {building.street} {building.street_number}
                {building.entrance ? <span className="font-normal text-slate-500">, ulaz {building.entrance}</span> : null}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {building.city}
                {building.municipality ? ` · ${building.municipality}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {premium ? (
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">⭐ Premium aktivan</span>
              ) : null}
              {membership ? (
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS[membership.verification_status]?.cls ?? STATUS.unverified.cls}`}>
                  {ROLE[membership.role] ?? membership.role} · {STATUS[membership.verification_status]?.label ?? membership.verification_status}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {!membership && !iAmManager ? <JoinBuildingClient buildingId={id} /> : null}

        {membership && membership.verification_status !== "verified" ? (
          <ProofUploadClient buildingId={id} status={membership.verification_status} />
        ) : null}

        {/* Upravnik zgrade */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Upravnik zgrade</h2>
            {canModerate ? (
              <Link href={`/zgrade/${id}/clanovi`} className="text-xs font-semibold text-brand-navy underline">
                Članovi i potvrde stanara →
              </Link>
            ) : null}
          </div>
          {active.length ? (
            active.map((a) => {
              const s = a.manager_user_id ? statsByUser.get(a.manager_user_id) : null;
              return (
                <div key={a.id} className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={managerLink(a)} className="text-lg font-semibold text-slate-900 hover:underline">
                      {managerName(a)}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {a.start_date ? `Upravlja od ${new Date(a.start_date).toLocaleDateString("sr-RS")} · ` : ""}
                      {s?.review_count ? `★ ${s.average_rating} (${s.review_count} recenzija)` : "Još nema recenzija"}
                      {!a.manager_user_id ? " · nema nalog na platformi" : ""}
                    </div>
                  </div>
                  {membership?.verification_status === "verified" ? (
                    <Link
                      href={
                        a.manager_user_id
                          ? `/upravnik/${a.manager_user_id}/recenzija?building_id=${id}`
                          : `/registar/${a.registry_id}/recenzija?building_id=${id}`
                      }
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Oceni upravnika
                    </Link>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="mt-2 text-sm text-slate-600">Zgrada još nema potvrđenog upravnika na platformi.</p>
          )}

          {pending.length && (membership || canModerate) ? (
            <div className="mt-3 space-y-1">
              {pending.map((a) => (
                <div key={a.id} className="text-xs text-amber-700">
                  ⏳ {managerName(a)} — {a.requested_by === a.manager_user_id ? "upravnik je zatražio zgradu" : "predlog stanara"}, čeka potvrdu
                </div>
              ))}
            </div>
          ) : null}

          {membership && !active.length ? <RegistryManagerSuggestClient buildingId={id} /> : null}

          {isVerifiedManager && !iAmManager && !iRequested ? <AssignmentRequestClient buildingId={id} /> : null}
          {isVerifiedManager && !iAmManager && !active.length && !(offers ?? []).some((o) => o.manager_user_id === user.id) ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Ponudi upravljanje ovoj zgradi</summary>
              <OfferForm buildingId={id} />
            </details>
          ) : null}
        </section>

        {/* Ponude upravnika */}
        {(offers ?? []).length && membership ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ponude upravnika ({offers!.length})</h2>
            <p className="mt-1 text-xs text-slate-500">
              Upravnika bira skupština stambene zajednice. Ovde možete uporediti ponude i ocene upravnika.
            </p>
            <div className="mt-3 space-y-3">
              {offers!.map((o) => {
                const s = statsByUser.get(o.manager_user_id);
                return (
                  <div key={o.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/upravnik/${o.manager_user_id}`} className="font-semibold text-slate-900 hover:underline">
                        {nameByUser.get(o.manager_user_id) ?? "Upravnik"}
                      </Link>
                      <span className="text-xs text-slate-500">
                        {s?.review_count ? `★ ${s.average_rating} (${s.review_count})` : "bez recenzija"}
                        {o.price_monthly_rsd != null ? ` · ${o.price_monthly_rsd.toLocaleString("sr-RS")} RSD/mes` : ""}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{o.message}</p>
                    <div className="mt-2 text-xs text-slate-500">
                      {[o.contact_email, o.contact_phone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => {
            const locked = item.premium && !premium;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  locked ? "border-amber-100" : "border-slate-100"
                }`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${locked ? "bg-amber-50" : "bg-slate-50"}`}>
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{item.label}</span>
                    {locked ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Premium</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{item.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
