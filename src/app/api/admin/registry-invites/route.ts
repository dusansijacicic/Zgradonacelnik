import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isAdmin, jsonError, siteUrl } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { managerInviteEmail, sendEmailBatch } from "@/lib/email";
import { signToken } from "@/lib/otp";

export const maxDuration = 60;

const bodySchema = z.object({
  limit: z.number().int().min(1).max(100),
  mode: z.enum(["first", "reminder"]).default("first"),
});

/**
 * Pozivi upravnicima iz registra: aktivni, sa emailom, bez naloga, nisu se odjavili.
 * Jedan mejl po adresi (više licenci može deliti isti email). Šalje se u turama (Resend free: 100/dan).
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  if (!(await isAdmin(supabase, user.id))) return jsonError("forbidden", 403);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("bad_request", 400);
  const { limit, mode } = body.data;

  const admin = createSupabaseAdminClient();
  const { data: claimedRows } = await admin.from("user_profiles").select("registry_id").not("registry_id", "is", null);
  const claimed = new Set((claimedRows ?? []).map((r) => r.registry_id));

  let query = admin
    .from("professional_manager_registry")
    .select("id, full_name, email, normalized_email, invite_count")
    .eq("is_active", true)
    .eq("email_opt_out", false)
    .not("normalized_email", "is", null)
    .order("id", { ascending: true })
    .limit(limit * 3);
  query =
    mode === "first"
      ? query.eq("invite_count", 0)
      : query.eq("invite_count", 1).lt("invited_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
  const { data: candidates, error } = await query;
  if (error) return jsonError("db_error", 500, error.message);

  const byEmail = new Map<string, { ids: number[]; fullName: string; firstId: number }>();
  for (const c of candidates ?? []) {
    if (claimed.has(c.id)) continue;
    const email = String(c.normalized_email);
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) continue;
    const entry = byEmail.get(email);
    if (entry) entry.ids.push(c.id);
    else if (byEmail.size < limit) byEmail.set(email, { ids: [c.id], fullName: c.full_name, firstId: c.id });
  }

  const site = siteUrl();
  const emails = Array.from(byEmail.entries()).map(([email, v]) =>
    managerInviteEmail({
      to: email,
      fullName: v.fullName,
      loginUrl: `${site}/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/manager/verifikacija")}`,
      profileUrl: `${site}/registar/${v.firstId}`,
      unsubscribeUrl: `${site}/odjava-poziva?id=${v.firstId}&t=${signToken(`unsub:${v.firstId}`)}`,
    }),
  );

  const sent = await sendEmailBatch(emails);

  // Označi samo poslate (batch ide redom; ako pukne, ostali ostaju za sledeću turu).
  const sentIds = Array.from(byEmail.values())
    .slice(0, sent)
    .flatMap((v) => v.ids);
  // U TEST modu mejlovi idu na TEST_EMAIL — ne označavaj prave upravnike kao pozvane.
  if (sentIds.length && !process.env.TEST_EMAIL) {
    const nowIso = new Date().toISOString();
    await admin
      .from("professional_manager_registry")
      .update({ invited_at: nowIso, invite_count: mode === "first" ? 1 : 2 })
      .in("id", sentIds);
  }

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "registry_invites_send",
    entity_type: "professional_manager_registry",
    metadata: { mode, requested: limit, sent, test_mode: Boolean(process.env.TEST_EMAIL) },
  });

  return NextResponse.json({ sent, prepared: emails.length, testMode: Boolean(process.env.TEST_EMAIL) });
}
