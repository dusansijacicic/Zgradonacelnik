import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getPlaceBySlug, getPlaces } from "@/lib/places";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Najveća mesta se prave pri build-u; ostala pri prvoj poseti (pa se keširaju).
  const places = await getPlaces();
  return places
    .slice()
    .sort((a, b) => b.managersCount - a.managersCount)
    .slice(0, 40)
    .map((p) => ({ grad: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ grad: string }> }): Promise<Metadata> {
  const { grad } = await params;
  const place = await getPlaceBySlug(grad);
  if (!place) return { title: "Mesto nije pronađeno", robots: { index: false } };
  return {
    title: `Upravnici zgrada — ${place.name} (${place.managersCount} licenciranih)`,
    description: `Licencirani profesionalni upravnici zgrada u mestu ${place.name}: ${place.managersCount} upravnika iz registra PKS, broj licence i ocene stanara. Pronađite upravnika za svoju stambenu zajednicu.`,
    alternates: { canonical: `/upravnici-zgrada/${place.slug}` },
    openGraph: { url: `/upravnici-zgrada/${place.slug}` },
  };
}

type Row = {
  id: number;
  full_name: string;
  license_number: string | null;
  platform_user_id: string | null;
  average_rating: number | null;
  review_count: number;
  active_buildings_count: number;
};

export default async function PlacePage({ params }: { params: Promise<{ grad: string }> }) {
  const { grad } = await params;
  const place = await getPlaceBySlug(grad);
  if (!place) notFound();

  const { data } = await createSupabasePublicClient().rpc("rpc_pretraga_registry", {
    p_q: "",
    p_municipality: place.name,
    p_limit: 250,
    p_offset: 0,
    p_sort: "rating_desc",
  });
  // ilike '%Niš%' bi uhvatio i "Niška Banja" — zadrži samo tačno mesto.
  const rows = ((data ?? []) as (Row & { municipality: string | null })[]).filter(
    (r) => (r.municipality ?? "").trim() === place.name,
  );

  const href = (r: Row) => (r.platform_user_id ? `/upravnik/${r.platform_user_id}` : `/registar/${r.id}`);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Upravnici zgrada — ${place.name}`,
            numberOfItems: rows.length,
            itemListElement: rows.slice(0, 100).map((r, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE_URL}${href(r)}`,
              name: r.full_name,
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Upravnici zgrada", item: `${SITE_URL}/upravnici-zgrada` },
              { "@type": "ListItem", position: 2, name: place.name },
            ],
          },
        ]}
      />
      <main className="w-full max-w-4xl">
        <nav className="mb-4 text-sm text-slate-500" aria-label="Putanja">
          <Link href="/upravnici-zgrada" className="hover:text-slate-800">Upravnici zgrada</Link> / {place.name}
        </nav>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Upravnici zgrada — {place.name}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          U registru Privredne komore Srbije za mesto {place.name} upisano je {rows.length}{" "}
          {rows.length === 1 ? "licenciran profesionalni upravnik" : "licenciranih profesionalnih upravnika"}. Upravnika bira
          skupština stambene zajednice; pre izbora proverite licencu i ocene stanara iz zgrada kojima već upravlja.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={href(r)} prefetch={false} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-0 flex-1 font-medium text-slate-900">{r.full_name}</span>
                  {r.platform_user_id ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Na platformi</span>
                  ) : null}
                  <span className="text-xs tabular-nums text-slate-500">
                    {r.review_count ? `★ ${r.average_rating} · ${r.review_count} rec.` : "bez ocena"}
                  </span>
                  {r.license_number ? <span className="font-mono text-xs text-slate-400">lic. {r.license_number}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
          {!rows.length ? <p className="p-4 text-sm text-slate-500">Trenutno nema aktivnih upravnika za ovo mesto.</p> : null}
        </div>

        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Kako da izaberete upravnika</h2>
            <p className="mt-2 text-sm text-slate-600">
              Proverite da li je upravnik aktivan u registru, pitajte za reference iz zgrada kojima upravlja i tražite
              redovne izveštaje o finansijama. Na profilu svakog upravnika vidite ocene stanara.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Vaša zgrada u mestu {place.name}?</h2>
            <p className="mt-2 text-sm text-slate-600">
              <Link href="/login" className="font-semibold text-slate-900 underline">Dodajte zgradu</Link> — upravnici sa
              platforme mogu da vam pošalju ponudu, a vi da uporedite ocene.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
