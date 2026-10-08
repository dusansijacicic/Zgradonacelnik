import type { Metadata } from "next";
import Link from "next/link";
import { getPlaces, placeGroup } from "@/lib/places";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Upravnici zgrada po mestima — licencirani upravnici u Srbiji",
  description:
    "Spisak licenciranih profesionalnih upravnika zgrada po gradovima i opštinama u Srbiji, iz registra Privredne komore Srbije, sa ocenama stanara.",
  alternates: { canonical: "/upravnici-zgrada" },
  openGraph: { url: "/upravnici-zgrada" },
};

export default async function PlacesIndexPage() {
  const places = await getPlaces();
  const total = places.reduce((s, p) => s + p.managersCount, 0);

  // Grupisanje: Beograd (opštine), Niš (opštine)… zatim ostala mesta.
  const groups = new Map<string, typeof places>();
  for (const p of places) {
    const g = placeGroup(p.name);
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  const sorted = Array.from(groups.entries()).sort(
    (a, b) => b[1].reduce((s, p) => s + p.managersCount, 0) - a[1].reduce((s, p) => s + p.managersCount, 0),
  );

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Upravnici zgrada po mestima",
          url: `${SITE_URL}/upravnici-zgrada`,
          inLanguage: "sr-Latn",
        }}
      />
      <main className="w-full max-w-5xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Upravnici zgrada po mestima</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          {total.toLocaleString("sr-RS")} licenciranih profesionalnih upravnika u {places.length} mesta, prema javnom
          registru Privredne komore Srbije. Izaberite mesto da vidite upravnike i ocene stanara.
        </p>

        <div className="mt-8 space-y-6">
          {sorted.map(([group, items]) => (
            <section key={group}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">{group}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {items.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/upravnici-zgrada/${p.slug}`}
                      prefetch={false}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 hover:border-slate-400"
                    >
                      {p.name}
                      <span className="text-xs tabular-nums text-slate-400">{p.managersCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!places.length ? <p className="text-slate-500">Registar trenutno nije dostupan.</p> : null}
        </div>
      </main>
    </div>
  );
}
