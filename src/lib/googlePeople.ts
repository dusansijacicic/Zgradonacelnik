/**
 * Čita profil sa Google People API (server-side, pristup samo access tokenu posle OAuth).
 * Zahteva scope-ove user.phonenumbers.read i user.addresses.read + People API uključen u GCP projektu.
 */
export type GoogleProfileSync = {
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  primaryPhoneRaw: string | null;
  primaryAddressFormatted: string | null;
};

type GooglePerson = {
  names?: { metadata?: { primary?: boolean }; givenName?: string; familyName?: string; displayName?: string }[];
  phoneNumbers?: { metadata?: { primary?: boolean }; value?: string; canonicalForm?: string }[];
  addresses?: { metadata?: { primary?: boolean }; formattedValue?: string }[];
};

function pickPrimary<T extends { metadata?: { primary?: boolean } }>(items: T[] | undefined): T | undefined {
  if (!items?.length) return undefined;
  const p = items.find((x) => x.metadata?.primary);
  return p ?? items[0];
}

export async function fetchGooglePersonMe(accessToken: string): Promise<GoogleProfileSync | null> {
  const url = new URL("https://people.googleapis.com/v1/people/me");
  url.searchParams.set("personFields", "names,phoneNumbers,addresses");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as GooglePerson;
  const name = pickPrimary(body.names);
  const phone = pickPrimary(body.phoneNumbers);
  const addr = pickPrimary(body.addresses);

  const primaryPhoneRaw =
    (typeof phone?.canonicalForm === "string" && phone.canonicalForm.trim()) ||
    (typeof phone?.value === "string" && phone.value.trim()) ||
    null;

  const primaryAddressFormatted =
    (typeof addr?.formattedValue === "string" && addr.formattedValue.trim()) || null;

  return {
    givenName: (typeof name?.givenName === "string" && name.givenName.trim()) || null,
    familyName: (typeof name?.familyName === "string" && name.familyName.trim()) || null,
    displayName: (typeof name?.displayName === "string" && name.displayName.trim()) || null,
    primaryPhoneRaw,
    primaryAddressFormatted,
  };
}
