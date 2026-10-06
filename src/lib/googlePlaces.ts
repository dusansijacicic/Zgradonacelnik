import { z } from "zod";

/**
 * Google Places API (New) — samo server-side (ključ GOOGLE_MAPS_API_KEY nikad ne ide u browser).
 * Autocomplete + Place Details dele isti sessionToken, pa Google naplaćuje samo Details poziv.
 * U GCP konzoli ključ ograniči na "Places API (New)".
 */

const LANGUAGE = "sr-Latn";
const REGION = "rs";

export class PlacesConfigError extends Error {}

function apiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new PlacesConfigError("GOOGLE_MAPS_API_KEY nije postavljen.");
  return key;
}

const autocompleteSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string(),
            text: z.object({ text: z.string() }).optional(),
            structuredFormat: z
              .object({
                mainText: z.object({ text: z.string() }).optional(),
                secondaryText: z.object({ text: z.string() }).optional(),
              })
              .optional(),
            types: z.array(z.string()).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type AddressSuggestion = {
  placeId: string;
  main: string;
  secondary: string;
};

export async function autocompleteAddress(input: string, sessionToken: string): Promise<AddressSuggestion[]> {
  const key = apiKey();

  async function call(withTypes: boolean) {
    return fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input,
        sessionToken,
        languageCode: LANGUAGE,
        regionCode: REGION,
        includedRegionCodes: [REGION],
        ...(withTypes ? { includedPrimaryTypes: ["street_address", "premise", "subpremise"] } : {}),
      }),
      cache: "no-store",
    });
  }

  let res = await call(true);
  // Ako Google odbije filter tipova (400), ponovi bez njega — Details ionako proverava kućni broj.
  if (res.status === 400) res = await call(false);
  if (!res.ok) throw new Error(`places_autocomplete_${res.status}`);

  const parsed = autocompleteSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return [];

  return (parsed.data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

const detailsSchema = z.object({
  id: z.string(),
  formattedAddress: z.string().optional(),
  types: z.array(z.string()).optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  addressComponents: z
    .array(
      z.object({
        longText: z.string().optional(),
        shortText: z.string().optional(),
        types: z.array(z.string()),
      }),
    )
    .optional(),
});

export type ParsedPlaceAddress = {
  placeId: string;
  /** true kada je Google mesto baš adresa (ne firma/objekat) — tada je place_id kanonski ključ adrese. */
  isAddressPlace: boolean;
  formattedAddress: string;
  street: string;
  streetNumber: string;
  city: string;
  municipality: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export class AddressNotPreciseError extends Error {}

export async function getPlaceAddress(placeId: string, sessionToken?: string): Promise<ParsedPlaceAddress> {
  const key = apiKey();
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) throw new AddressNotPreciseError("invalid_place_id");

  const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
  url.searchParams.set("languageCode", LANGUAGE);
  url.searchParams.set("regionCode", REGION);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const res = await fetch(url.toString(), {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location,types",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`places_details_${res.status}`);

  const parsed = detailsSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new Error("places_details_parse");
  const d = parsed.data;

  const comps = d.addressComponents ?? [];
  const get = (...types: string[]) => {
    for (const t of types) {
      const c = comps.find((x) => x.types.includes(t));
      const v = c?.longText?.trim();
      if (v) return v;
    }
    return "";
  };

  const countryCode = comps.find((c) => c.types.includes("country"))?.shortText?.toUpperCase();
  if (countryCode && countryCode !== "RS") throw new AddressNotPreciseError("not_serbia");

  const street = get("route");
  const streetNumber = get("street_number");
  if (!street || !streetNumber) throw new AddressNotPreciseError("missing_street_number");

  const city = get("locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2");
  if (!city) throw new AddressNotPreciseError("missing_city");

  const municipalityRaw = get("sublocality_level_1", "sublocality", "administrative_area_level_3");
  const municipality = municipalityRaw && municipalityRaw !== city ? municipalityRaw : null;

  const types = d.types ?? [];
  const isAddressPlace = types.some((t) => t === "street_address" || t === "premise" || t === "subpremise");

  return {
    placeId: d.id,
    isAddressPlace,
    formattedAddress: d.formattedAddress ?? `${street} ${streetNumber}, ${city}`,
    street,
    streetNumber,
    city,
    municipality,
    postalCode: get("postal_code") || null,
    country: "Srbija",
    latitude: d.location?.latitude ?? null,
    longitude: d.location?.longitude ?? null,
  };
}

export const ADDRESS_ERROR_MESSAGES: Record<string, string> = {
  missing_street_number: "Izaberi tačnu adresu sa kućnim brojem (ne samo ulicu).",
  missing_city: "Google nije vratio grad za ovu adresu. Pokušaj sa punom adresom.",
  not_serbia: "Podržane su samo adrese u Srbiji.",
  invalid_place_id: "Nevalidna adresa. Izaberi ponovo iz liste.",
};
