import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { slugify } from "@/lib/seo";

export type Place = { name: string; slug: string; managersCount: number };

/** Sva mesta iz aktivnog registra (keš 1 dan; menja se samo sinhronizacijom registra). */
export const getPlaces = unstable_cache(
  async (): Promise<Place[]> => {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("rpc_registry_places");
    if (error || !data) {
      // Pre migracije 0012: lista mesta bez broja upravnika.
      const { data: names } = await supabase.rpc("rpc_registry_municipalities");
      return ((names ?? []) as { name: string }[]).map((p) => ({ name: p.name, slug: slugify(p.name), managersCount: 0 }));
    }
    return (data as { name: string; managers_count: number }[]).map((p) => ({
      name: p.name,
      slug: slugify(p.name),
      managersCount: p.managers_count,
    }));
  },
  ["registry-places"],
  { revalidate: 86400, tags: ["registry"] },
);

export async function getPlaceBySlug(slug: string) {
  const places = await getPlaces();
  return places.find((p) => p.slug === slug) ?? null;
}

/** "Beograd (Novi Beograd)" → grupa "Beograd"; "Niš (Medijana)" → "Niš". */
export function placeGroup(name: string) {
  return name.replace(/\s*\(.*\)\s*$/, "").trim();
}
