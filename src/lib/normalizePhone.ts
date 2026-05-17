/** Ista logika kao `public.normalize_phone` u bazi: samo cifre i +. */
export function normalizePhoneClient(input: string | null | undefined): string | null {
  if (input == null) return null;
  const s = String(input).replace(/[^\d+]/g, "").trim();
  return s.length ? s : null;
}
