import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AddressNotPreciseError, getPlaceAddress } from "@/lib/googlePlaces";

/**
 * Validira Google place_id na serveru i vraća postojeću zgradu ili je pravi (prvi korisnik na adresi).
 * Zgrade se NE prave iz klijentskih podataka — samo iz odgovora Google Places API-ja.
 */
export async function findOrCreateBuildingFromPlace(params: {
  placeId: string;
  sessionToken?: string;
  entrance?: string | null;
  userId: string;
}) {
  const addr = await getPlaceAddress(params.placeId, params.sessionToken);
  const admin = createSupabaseAdminClient();

  const entrance = params.entrance?.trim().slice(0, 10) || null;

  const { data, error } = await admin.rpc("find_or_create_building", {
    p_google_place_id: addr.isAddressPlace ? addr.placeId : null,
    p_country: addr.country,
    p_city: addr.city,
    p_municipality: addr.municipality,
    p_street: addr.street,
    p_street_number: addr.streetNumber,
    p_entrance: entrance,
    p_postal_code: addr.postalCode,
    p_latitude: addr.latitude,
    p_longitude: addr.longitude,
    p_formatted_address: addr.formattedAddress,
    p_created_by: params.userId,
  });
  if (error) throw new Error(`find_or_create_building: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data) as { building_id: string; created: boolean } | undefined;
  if (!row?.building_id) throw new Error("find_or_create_building: empty");

  return { buildingId: row.building_id, created: row.created, address: addr };
}

export { AddressNotPreciseError };
