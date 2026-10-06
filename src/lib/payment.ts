/**
 * Model pretplate: Premium se plaća PO ZGRADI, mesečno. Upravnik (ili admin) pravi porudžbinu
 * za jednu ili više svojih zgrada i plaća jednom uplatom (poziv na broj, model 97).
 */

export const PREMIUM_PRICE_PER_BUILDING_RSD = Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_RSD ?? 500);

export const BILLING_OPTIONS = [
  { months: 1, label: "1 mesec", paidMonths: 1 },
  { months: 6, label: "6 meseci", paidMonths: 6 },
  { months: 12, label: "12 meseci (2 meseca gratis)", paidMonths: 10 },
] as const;

export type BillingMonths = (typeof BILLING_OPTIONS)[number]["months"];

export function orderAmountRsd(buildingCount: number, months: BillingMonths) {
  const opt = BILLING_OPTIONS.find((o) => o.months === months) ?? BILLING_OPTIONS[0];
  return buildingCount * PREMIUM_PRICE_PER_BUILDING_RSD * opt.paidMonths;
}

/**
 * Poziv na broj po modelu 97: dve kontrolne cifre (ISO 7064, MOD 97-10) + osnovni broj.
 * Banke u Srbiji odbijaju model 97 sa slovima ili pogrešnim kontrolnim brojem.
 */
export function model97Reference(base: string) {
  const digits = base.replace(/\D/g, "");
  if (!digits) throw new Error("model97: prazan broj");
  let rem = 0;
  for (const ch of `${digits}00`) rem = (rem * 10 + Number(ch)) % 97;
  const control = String(98 - rem).padStart(2, "0");
  return `${control}${digits}`;
}

export function isValidModel97(reference: string) {
  const digits = reference.replace(/\D/g, "");
  if (digits.length < 3) return false;
  return model97Reference(digits.slice(2)) === digits;
}

/** Osnova: godina (2 cifre) + 7 nasumičnih cifara → npr. 26 1234567 → "XX261234567". */
export function newPaymentReference() {
  const year = String(new Date().getFullYear()).slice(-2);
  const rand = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  return model97Reference(`${year}${rand}`);
}

export function paymentDetails() {
  return {
    accountNumber: process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER ?? "",
    recipient: process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT ?? "Zgradonačelnik.rs",
    model: "97",
  };
}
