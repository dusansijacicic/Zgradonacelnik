import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL, slugify } from "@/lib/seo";

// Statična stranica sa CDN-a, osvežava se na sat (nove recenzije, promene u registru).
export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

const getRow = cache(async (id: number) => {
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("professional_manager_registry")
    .select("id, full_name, municipality, license_number, is_active")
    .eq("id", id)
    .maybeSingle();
  return data;
});

function parseId(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 && String(id) === raw ? id : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: raw } = await params;
  const id = parseId(raw);
  const row = id ? await getRow(id) : null;
  if (!row) return { title: "Upravnik nije pronađen", robots: { index: false } };
  const place = row.municipality ? `, ${row.municipality}` : "";
  return {
    title: `${row.full_name} — upravnik zgrade${place}`,
    description: `${row.full_name} je profesionalni upravnik zgrada${place}${
      row.license_number ? ` sa licencom PKS br. ${row.license_number}` : ""
    }. Ocene i recenzije stanara na Zgradonačelnik.rs.`,
    alternates: { canonical: `/registar/${row.id}` },
    openGraph: { url: `/registar/${row.id}`, type: "profile" },
    robots: row.is_active ? undefined : { index: false, follow: true },
  };
}

export default async function RegistryManagerPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) notFound();

  const row = await getRow(id);
  if (!row) notFound();

  const supabase = createSupabasePublicClient();

  // Upravnik je preuzeo profil → kanonski profil je nalog na platformi.
  const { data: claimed } = await supabase.from("manager_public_profiles").select("user_id").eq("registry_id", id).maybeSingle();
  if (claimed?.user_id) redirect(`/upravnik/${claimed.user_id}`);

  const { data: reviews } = await supabase
    .from("manager_reviews")
    .select("id, rating_overall, title, content, created_at")
    .eq("registry_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(30);

  const list = reviews ?? [];
  const reviewIds = list.map((r) => r.id);
  const { data: replies } = reviewIds.length
    ? await supabase.from("review_replies").select("review_id, content").in("review_id", reviewIds).eq("status", "published")
    : { data: [] as { review_id: string; content: string }[] };
  const replyByReview = new Map((replies ?? []).map((r) => [r.review_id, r.content]));

  const avg = list.length ? list.reduce((s, r) => s + (r.rating_overall ?? 0), 0) / list.length : null;
  const placeSlug = row.municipality ? slugify(row.municipality) : null;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Person",
            name: row.full_name,
            jobTitle: "Profesionalni upravnik zgrada",
            url: `${SITE_URL}/registar/${row.id}`,
            ...(row.municipality ? { workLocation: { "@type": "Place", name: row.municipality } } : {}),
            ...(row.license_number
              ? {
                  hasCredential: {
                    "@type": "EducationalOccupationalCredential",
                    credentialCategory: "Licenca profesionalnog upravnika",
                    identifier: row.license_number,
                    recognizedBy: { "@type": "Organization", name: "Privredna komora Srbije" },
                  },
                }
              : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Upravnici zgrada", item: `${SITE_URL}/upravnici-zgrada` },
              ...(placeSlug
                ? [{ "@type": "ListItem", position: 2, name: row.municipality, item: `${SITE_URL}/upravnici-zgrada/${placeSlug}` }]
                : []),
              { "@type": "ListItem", position: placeSlug ? 3 : 2, name: row.full_name },
            ],
          },
        ]}
      />
      <main className="w-full max-w-4xl">
        <nav className="mb-4 text-sm text-zinc-500" aria-label="Putanja">
          <Link href="/upravnici-zgrada" className="hover:text-zinc-800">Upravnici zgrada</Link>
          {placeSlug ? (
            <>
              {" / "}
              <Link href={`/upravnici-zgrada/${placeSlug}`} className="hover:text-zinc-800">{row.municipality}</Link>
            </>
          ) : null}
        </nav>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{row.full_name}</h1>
              <p className="mt-2 text-sm text-zinc-600">
                Profesionalni upravnik zgrada
                {row.municipality ? ` · ${row.municipality}` : ""}
                {row.license_number ? ` · licenca PKS br. ${row.license_number}` : ""}
              </p>
              {!row.is_active ? (
                <p className="mt-3 inline-block rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                  Obrisan iz registra PKS — licenca nije aktivna
                </p>
              ) : null}
              <p className="mt-3 max-w-prose text-xs text-zinc-500">
                Podaci iz javnog registra Privredne komore Srbije. Upravnik još nema nalog na platformi; ocene ostavljaju
                stanari zgrada kojima upravlja.
              </p>
            </div>
            <Link
              href={`/registar/${row.id}/recenzija`}
              prefetch={false}
              className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
            >
              Ostavi recenziju
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500">Prosečna ocena</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">{avg ? `★ ${avg.toFixed(2)}` : "—"}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500">Broj recenzija</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">{list.length}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500">Licenca</div>
              <div className="mt-1 font-mono text-sm text-zinc-800">{row.license_number ?? "—"}</div>
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Recenzije stanara</h2>
          <div className="mt-4 grid gap-3">
            {list.map((r) => (
              <article key={r.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-900" aria-label={`Ocena ${r.rating_overall} od 5`}>
                    {"★".repeat(r.rating_overall)}
                    {"☆".repeat(5 - r.rating_overall)}
                  </div>
                  <time className="text-xs text-zinc-500" dateTime={r.created_at}>
                    {new Date(r.created_at).toLocaleDateString("sr-RS")}
                  </time>
                </div>
                {r.title ? <h3 className="mt-2 text-sm font-medium text-zinc-900">{r.title}</h3> : null}
                {r.content ? <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{r.content}</p> : null}
                {replyByReview.get(r.id) ? (
                  <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                    <div className="text-xs font-medium text-zinc-600">Odgovor upravnika</div>
                    <div className="mt-1 whitespace-pre-wrap">{replyByReview.get(r.id)}</div>
                  </div>
                ) : null}
                <a
                  href={`/registar/${row.id}/prijavi-recenziju?review_id=${encodeURIComponent(r.id)}`}
                  className="mt-3 inline-block text-xs text-zinc-500 underline underline-offset-4"
                  rel="nofollow"
                >
                  Prijavi recenziju
                </a>
              </article>
            ))}
            {!list.length ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                Još nema objavljenih recenzija. Ako vam je {row.full_name} upravnik zgrade,{" "}
                <Link href="/login" className="font-medium underline">prijavite se</Link> i ostavite prvu ocenu.
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
