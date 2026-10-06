import crypto from "crypto";

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * HMAC sa serverskom tajnom: korisnik može da pročita svoj red iz baze (RLS "select own"),
 * pa običan sha256 od 6 cifara bi se probio za milisekunde.
 */
export function hashOtp(otp: string) {
  const secret = process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("OTP_SECRET nije postavljen");
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

export function otpMatches(otp: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const a = Buffer.from(hashOtp(otp), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Potpisani token (npr. za odjavu od poziva) — bez čuvanja u bazi. */
export function signToken(value: string) {
  const secret = process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return crypto.createHmac("sha256", secret).update(`v1:${value}`).digest("base64url").slice(0, 32);
}

export function verifySignedToken(value: string, token: string | null | undefined) {
  if (!token) return false;
  const expected = Buffer.from(signToken(value));
  const got = Buffer.from(token);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}
