import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPremiumActivatedNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    building_id: string;
    action: "activate" | "deactivate" | "cancel";
    months?: number;
  };

  const { building_id, action, months = 1 } = body;
  if (!building_id || !action) {
    return NextResponse.json({ error: "building_id and action required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();

  if (action === "activate") {
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + months);

    // Get existing subscription to find who subscribed
    const { data: existingSub } = await admin
      .from("building_subscriptions")
      .select("subscribed_by")
      .eq("building_id", building_id)
      .maybeSingle();

    const { error } = await admin.from("building_subscriptions").upsert(
      {
        building_id,
        subscribed_by: existingSub?.subscribed_by ?? user.id,
        status: "active",
        activated_by: user.id,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      },
      { onConflict: "building_id" },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Email notifikacija manageru (fire-and-forget)
    if (existingSub?.subscribed_by) {
      void (async () => {
        try {
          const [managerUser, buildingData] = await Promise.all([
            admin.auth.admin.getUserById(existingSub.subscribed_by),
            supabase.from("buildings").select("street, street_number, city").eq("id", building_id).maybeSingle(),
          ]);
          const managerEmail = managerUser.data?.user?.email;
          if (!managerEmail) return;
          const addr = buildingData.data
            ? `${buildingData.data.street} ${buildingData.data.street_number}, ${buildingData.data.city}`
            : building_id;
          await sendPremiumActivatedNotification({
            managerEmail,
            managerName: managerUser.data.user?.user_metadata?.full_name ?? "Upravnik",
            buildingAddress: addr,
            periodEnd: periodEnd.toLocaleDateString("sr-RS"),
            buildingUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/zgrade/${building_id}`,
          });
        } catch { /* ne blokiramo */ }
      })();
    }

    return NextResponse.json({ ok: true, period_end: periodEnd.toISOString() });
  }

  if (action === "deactivate" || action === "cancel") {
    const { error } = await admin
      .from("building_subscriptions")
      .update({ status: action === "cancel" ? "cancelled" : "inactive" })
      .eq("building_id", building_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
