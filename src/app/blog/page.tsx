import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getPublishedPosts } from "@/lib/blog";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

// Statično; admin pri objavi poziva revalidatePath("/blog") pa se novi tekst vidi odmah.
export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog — saveti za stanare i upravnike zgrada",
  description:
    "Praktični saveti o upravljanju stambenim zgradama: izbor upravnika, finansije zgrade, prava i obaveze stanara.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
  openGraph: { url: "/blog" },
};

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="flex flex-1 justify-center bg-white px-4 py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `${SITE_NAME} blog`,
          url: `${SITE_URL}/blog`,
          inLanguage: "sr-Latn",
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE_URL}/blog/${p.slug}`,
            datePublished: p.published_at,
          })),
        }}
      />
      <main className="w-full max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Blog</h1>
        <p className="mt-2 text-slate-600">Saveti za stanare i upravnike zgrada.</p>

        <div className="mt-10 divide-y divide-slate-100">
          {posts.map((p) => (
            <article key={p.id} className="py-6 first:pt-0">
              <time className="text-xs font-medium uppercase tracking-wider text-slate-400" dateTime={p.published_at ?? undefined}>
                {formatDate(p.published_at)}
              </time>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                <Link href={`/blog/${p.slug}`} className="hover:underline">
                  {p.title}
                </Link>
              </h2>
              {p.excerpt ? <p className="mt-2 text-slate-600">{p.excerpt}</p> : null}
              {p.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {!posts.length ? <p className="py-6 text-slate-500">Uskoro prvi tekstovi.</p> : null}
        </div>
      </main>
    </div>
  );
}
