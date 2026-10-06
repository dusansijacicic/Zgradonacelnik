import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatAddress, jsonError, siteUrl } from "@/lib/api";
import { sendEmail } from "@/lib/email";

/**
 * Dnevni cron (vercel.json): označi istekle Premium pretplate i pošalji podsetnik 7 dana pre isteka.
 * Vercel šalje "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return jsonError("unauthorized", 401);

  const admin = createSupabaseAdminClient();
  const now = new Date();

  const { data: expired } = await admin
    .from("building_subscriptions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("current_period_end", now.toISOString())
    .select("building_id");

  const in7days = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
  const { data: expiring } = await admin
    .from("building_subscriptions")
    .select("building_id, subscribed_by, current_period_end, buildings(street, street_number, entrance, city)")
    .eq("status", "active")
    .is("reminder_sent_at", null)
    .gt("current_period_end", now.toISOString())
    .lt("current_period_end", in7days)
    .limit(200);

  let reminded = 0;
  for (const s of expiring ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(s.subscribed_by);
    const email = u?.user?.email;
    if (email) {
      await sendEmail({
        to: email,
        subject: "Premium zgrade ističe za manje od 7 dana",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#18181b">
            <p>Premium za zgradu <strong>${formatAddress(s.buildings as unknown as Parameters<typeof formatAddress>[0])}</strong>
            ističe <strong>${new Date(s.current_period_end!).toLocaleDateString("sr-RS")}</strong>.</p>
            <p>Posle isteka stanari gube pristup finansijama i zapisnicima.</p>
            <a href="${siteUrl()}/manager/pretplata">Produži Premium →</a>
          </div>`,
      }).catch(() => undefined);
      reminded++;
    }
    await admin.from("building_subscriptions").update({ reminder_sent_at: now.toISOString() }).eq("building_id", s.building_id);
  }

  return NextResponse.json({ expired: expired?.length ?? 0, reminded });
}
