import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBuildingPremium } from "@/lib/buildingPremium";
import { sendNewMinutesNotification } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  building_id: z.string().uuid(),
  title: z.string().min(2).max(200),
  held_at: z.string().datetime(),
  location: z.string().max(200).optional(),
  agenda: z.string().max(5000).optional(),
  decisions: z.string().max(10000).optional(),
  attendees_count: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Nevalidni podaci" }, { status: 400 });
  }

  const { building_id } = body.data;

  // Mora biti aktivan upravnik
  const { data: assignment } = await supabase
    .from("building_manager_assignments")
    .select("id")
    .eq("building_id", building_id)
    .eq("manager_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Samo aktivni upravnik može kreirati zapisnik." }, { status: 403 });
  }

  // Zgrada mora biti Premium
  const premium = await isBuildingPremium(supabase, building_id);
  if (!premium) {
    return NextResponse.json({ error: "Zapisnici su dostupni samo Premium zgradama." }, { status: 403 });
  }

  const { data: inserted, error } = await supabase
    .from("meeting_minutes")
    .insert({
      building_id,
      created_by: user.id,
      title: body.data.title,
      held_at: body.data.held_at,
      location: body.data.location ?? null,
      agenda: body.data.agenda ?? null,
      decisions: body.data.decisions ?? null,
      attendees_count: body.data.attendees_count ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notifikacija stanarima (fire-and-forget)
  void (async () => {
    try {
      const adminSb = createSupabaseAdminClient();
      const [buildingData, memberships] = await Promise.all([
        supabase.from("buildings").select("street, street_number, city").eq("id", building_id).maybeSingle(),
        supabase.from("building_memberships")
          .select("user_id")
          .eq("building_id", building_id)
          .eq("verification_status", "verified")
          .neq("user_id", user.id),
      ]);

      const addr = buildingData.data
        ? `${buildingData.data.street} ${buildingData.data.street_number}, ${buildingData.data.city}`
        : "";

      const residentEmails: string[] = [];
      for (const m of memberships.data ?? []) {
        const { data: u } = await adminSb.auth.admin.getUserById(m.user_id);
        if (u?.user?.email) residentEmails.push(u.user.email);
      }

      if (residentEmails.length) {
        await sendNewMinutesNotification({
          residentEmails,
          buildingAddress: addr,
          minutesTitle: body.data.title,
          heldAt: new Date(body.data.held_at).toLocaleDateString("sr-RS"),
          minutesUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/zgrade/${building_id}/zapisnici`,
        });
      }
    } catch { /* ne blokiramo */ }
  })();

  return NextResponse.json({ ok: true, id: inserted.id });
}
