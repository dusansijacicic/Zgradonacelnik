import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export function jsonError(error: string, status: number, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

/** Vraća 429 odgovor ako je limit premašen, inače null. Nikad ne baca izuzetak. */
export async function rateLimit(
  supabase: ServerClient,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const { data, error } = await supabase.rpc("rate_limit_check", {
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return jsonError("rate_limit_error", 500);
  if (!data) return jsonError("rate_limited", 429, "Previše pokušaja. Pokušaj ponovo kasnije.");
  return null;
}

export async function getSessionUser(): Promise<{ supabase: ServerClient; user: User | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function isAdmin(supabase: ServerClient, userId: string) {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.is_admin);
}

/** Dozvoljava samo relativne putanje unutar sajta (sprečava open redirect: //evil.com, /\evil.com). */
export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function formatAddress(b: {
  street?: string | null;
  street_number?: string | null;
  entrance?: string | null;
  city?: string | null;
} | null | undefined) {
  if (!b) return "";
  const line = [b.street, b.street_number].filter(Boolean).join(" ");
  return [line, b.entrance ? `ulaz ${b.entrance}` : null, b.city].filter(Boolean).join(", ");
}
