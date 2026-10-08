import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { formatDate, getPublishedPost, getPublishedPosts, readingMinutes, renderMarkdown } from "@/lib/blog";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL, truncate } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 86400;
export const dynamicParams = true;

const getPost = cache(getPublishedPost);

export async function generateStaticParams() {
  const posts = await getPublishedPosts(200);
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Tekst nije pronađen", robots: { index: false } };
  const description = post.seo_description || post.excerpt || truncate(post.content_md);
  return {
    title: post.seo_title || post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url: `/blog/${post.slug}`,
      title: post.seo_title || post.title,
      description,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      tags: post.tags,
      ...(post.cover_image_url ? { images: [post.cover_image_url] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.content_md);

  return (
    <div className="flex flex-1 justify-center bg-white px-4 py-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            datePublished: post.published_at,
            dateModified: post.updated_at,
            inLanguage: "sr-Latn",
            mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
            author: { "@type": "Organization", name: post.author_name },
            publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE_URL}/zgradonacelnik_logo.jpeg` } },
            ...(post.cover_image_url ? { image: post.cover_image_url } : {}),
            keywords: post.tags.join(", "),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
              { "@type": "ListItem", position: 2, name: post.title },
            ],
          },
        ]}
      />
      <article className="w-full max-w-2xl">
        <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-800">← Blog</Link>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
        <div className="mt-3 text-sm text-slate-500">
          <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at)}</time> · {readingMinutes(post.content_md)} min
          čitanja · {post.author_name}
        </div>
        {post.excerpt ? <p className="mt-6 text-lg leading-relaxed text-slate-700">{post.excerpt}</p> : null}
        <div className="prose-blog mt-8" dangerouslySetInnerHTML={{ __html: html }} />

        <aside className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="font-bold text-slate-900">Proverite svog upravnika</div>
          <p className="mt-1 text-sm text-slate-600">
            Licenca, ocene stanara i zgrade kojima upravlja — besplatno, za par sekundi.
          </p>
          <Link href="/pretraga" className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Pretraga upravnika →
          </Link>
        </aside>
      </article>
    </div>
  );
}
