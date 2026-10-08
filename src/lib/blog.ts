import { createSupabasePublicClient } from "@/lib/supabase/public";

export { renderMarkdown } from "@/lib/markdown";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_md: string;
  cover_image_url: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  author_name: string;
  published_at: string | null;
  updated_at: string;
};

const LIST_FIELDS = "id, slug, title, excerpt, cover_image_url, tags, author_name, published_at, updated_at";

export async function getPublishedPosts(limit = 50) {
  const { data } = await createSupabasePublicClient()
    .from("blog_posts")
    .select(LIST_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Omit<BlogPost, "content_md" | "seo_title" | "seo_description">[];
}

export async function getPublishedPost(slug: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const { data } = await createSupabasePublicClient()
    .from("blog_posts")
    .select(`${LIST_FIELDS}, content_md, seo_title, seo_description`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data ?? null) as BlogPost | null;
}

export function readingMinutes(md: string) {
  const words = md.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "long", year: "numeric" }) : "";
}
