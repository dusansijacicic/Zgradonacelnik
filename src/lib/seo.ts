export const SITE_NAME = "Zgradonačelnik.rs";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://zgradonacelnik-m2mj.vercel.app").replace(/\/$/, "");
export const SITE_DESCRIPTION =
  "Pronađite licenciranog upravnika zgrade iz PKS registra, pročitajte ocene stanara i pratite finansije svoje zgrade. Besplatno za stanare.";

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** "Beograd (Novi Beograd)" → "beograd-novi-beograd" (latinica, bez dijakritika). */
export function slugify(input: string) {
  const map: Record<string, string> = { đ: "dj", Đ: "dj", č: "c", ć: "c", š: "s", ž: "z", Č: "c", Ć: "c", Š: "s", Ž: "z" };
  return input
    .replace(/[đĐčćšžČĆŠŽ]/g, (ch) => map[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, max = 160) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
