import type { MetadataRoute } from "next";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getPublishedPosts } from "@/lib/blog";
import { getPlaces } from "@/lib/places";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

// Supabase vraća najviše 1000 redova po zahtevu — idemo stranu po stranu.
async function activeRegistryIds() {
  const supabase = createSupabasePublicClient();
  const ids: number[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase
      .from("professional_manager_registry")
      .select("id")
      .eq("is_active", true)
      .order("id")
      .range(from, from + 999);
    if (error || !data?.length) break;
    ids.push(...data.map((r) => r.id as number));
    if (data.length < 1000) break;
  }
  return ids;
}

/** Sve javne stranice: statične, blog, mesta, profili upravnika (registar + nalozi). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createSupabasePublicClient();
  const now = new Date();

  const [posts, places, registry, managers] = await Promise.all([
    getPublishedPosts(500).catch(() => []),
    getPlaces().catch(() => []),
    activeRegistryIds().catch(() => [] as number[]),
    supabase.from("manager_public_profiles").select("user_id, registry_id").eq("professional_manager_status", "verified").limit(1000),
  ]);

  const claimed = new Set((managers.data ?? []).map((m) => m.registry_id).filter(Boolean));

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pretraga`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/upravnici-zgrada`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/blog`, lastModified: posts[0]?.published_at ? new Date(posts[0].published_at) : now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/pretraga/mapa`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/pravila`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/uslovi`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privatnost`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/kontakt`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    ...staticPages,
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...places.map((p) => ({
      url: `${SITE_URL}/upravnici-zgrada/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...(managers.data ?? []).map((m) => ({
      url: `${SITE_URL}/upravnik/${m.user_id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...registry
      .filter((id) => !claimed.has(id))
      .map((id) => ({
        url: `${SITE_URL}/registar/${id}`,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
  ];
}
