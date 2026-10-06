import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/api";

export default async function ManagerPublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("manager_public_profiles")
    .select("user_id, display_name, municipality, city, professional_manager_status, registry_id")
    .eq("user_id", id)
    .maybeSingle();
  if (!profile) notFound();

  const [{ data: stats }, { data: reviews }, { data: registryRow }, { data: buildings }] = await Promise.all([
    supabase
      .from("manager_stats")
      .select("average_rating, review_count, transparency_rating, communication_rating, responsiveness_rating, active_buildings_count, historical_buildings_count")
      .eq("manager_user_id", id)
      .maybeSingle(),
    supabase
      .from("manager_reviews")
      .select("id, rating_overall, title, content, created_at")
      .eq("manager_user_id", id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(20),
    profile.registry_id
      ? supabase.from("professional_manager_registry").select("full_name, license_number, municipality, is_active").eq("id", profile.registry_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("building_manager_assignments")
      .select("status, start_date, end_date, buildings(id, street, street_number, entrance, city)")
      .eq("manager_user_id", id)
      .in("status", ["active", "ended"])
      .order("start_date", { ascending: false })
      .limit(50),
  ]);

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const { data: replies } = reviewIds.length
    ? await supabase.from("review_replies").select("review_id, content").in("review_id", reviewIds).eq("status", "published")
    : { data: [] as { review_id: string; content: string }[] };
  const replyByReview = new Map((replies ?? []).map((r) => [r.review_id, r.content]));

  const verified = profile.professional_manager_status === "verified";
  const dims = [
    ["Transparentnost", stats?.transparency_rating],
    ["Komunikacija", stats?.communication_rating],
    ["Ažurnost", stats?.responsiveness_rating],
  ] as const;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{profile.display_name}</h1>
              <p className="mt-1 text-sm text-zinc-600">
                {[profile.city, profile.municipality].filter(Boolean).join(" · ")}
                {registryRow?.license_number ? ` · licenca PKS br. ${registryRow.license_number}` : ""}
              </p>
              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  verified ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {verified ? "✓ Verifikovan upravnik (PKS registar)" : "Licenca nije aktivna u registru"}
              </span>
            </div>
            <Link href={`/upravnik/${id}/recenzija`} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
              Ostavi recenziju
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              ["Prosečna ocena", stats?.average_rating ? `★ ${stats.average_rating}` : "—"],
              ["Recenzija", stats?.review_count ?? 0],
              ["Aktivne zgrade", stats?.active_buildings_count ?? 0],
              ["Bivše zgrade", stats?.historical_buildings_count ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-zinc-200 p-4">
                <div className="text-xs text-zinc-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
              </div>
            ))}
          </div>
          {stats?.review_count ? (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-600">
              {dims.map(([label, v]) => (
                <span key={label}>
                  {label}: <strong>{v ?? "—"}</strong>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {buildings?.length ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Zgrade</h2>
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {buildings.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span>{formatAddress(a.buildings as unknown as Parameters<typeof formatAddress>[0])}</span>
                  <span className={`text-xs ${a.status === "active" ? "text-emerald-700" : "text-zinc-400"}`}>
                    {a.status === "active" ? "aktivno" : `do ${a.end_date ? new Date(a.end_date).toLocaleDateString("sr-RS") : "—"}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Recenzije stanara</h2>
          <div className="mt-4 grid gap-3">
            {(reviews ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-900">{"★".repeat(r.rating_overall)}{"☆".repeat(5 - r.rating_overall)}</div>
                  <div className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleDateString("sr-RS")}</div>
                </div>
                {r.title ? <div className="mt-2 text-sm font-medium text-zinc-900">{r.title}</div> : null}
                {r.content ? <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{r.content}</div> : null}
                {replyByReview.get(r.id) ? (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                    <div className="text-xs font-medium text-zinc-600">Odgovor upravnika</div>
                    <div className="mt-1 whitespace-pre-wrap">{replyByReview.get(r.id)}</div>
                  </div>
                ) : null}
                <a
                  href={`/upravnik/${id}/prijavi-recenziju?review_id=${encodeURIComponent(r.id)}`}
                  className="mt-3 inline-block text-xs text-zinc-500 underline underline-offset-4"
                >
                  Prijavi recenziju
                </a>
              </div>
            ))}
            {!reviews?.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">Nema objavljenih recenzija.</div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
