import { z } from "zod";

const verifyRespSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
});

export async function verifyTurnstileToken(params: {
  token: string | null | undefined;
  remoteIp?: string | null;
}) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // If not configured, captcha is disabled (MVP friendly).
  if (!secret) return { ok: true as const, disabled: true as const };

  if (!params.token) return { ok: false as const, disabled: false as const };

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", params.token);
  if (params.remoteIp) form.append("remoteip", params.remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const json = verifyRespSchema.safeParse(await res.json().catch(() => null));
  if (!json.success) return { ok: false as const, disabled: false as const };
  return { ok: json.data.success as boolean, disabled: false as const };
}

