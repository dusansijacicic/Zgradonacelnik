import crypto from "crypto";

export function generateOtp() {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  return otp;
}

export function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

