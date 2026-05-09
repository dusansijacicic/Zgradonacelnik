import { z } from "zod";

const mapboxRespSchema = z.object({
  features: z
    .array(
      z.object({
        center: z.tuple([z.number(), z.number()]), // [lng, lat]
      }),
    )
    .default([]),
});

export async function geocodeAddressMapbox(address: string) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address,
    )}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("language", "sr");
  url.searchParams.set("country", "RS");

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) return null;
  const parsed = mapboxRespSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return null;
  const feature = parsed.data.features[0];
  if (!feature) return null;
  const [lng, lat] = feature.center;
  return { lat, lng };
}

