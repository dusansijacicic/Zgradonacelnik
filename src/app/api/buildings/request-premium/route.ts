import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendPremiumRequestNotification } from "@/lib/email";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { building_id } = (await request.json()) as { building_id?: string };
  if (!building_id) return NextResponse.json({ error: "building_id required" }, { status: 400 });

  const { data: assignment } = await supabase
    .from("building_manager_assignments")
    .select("id")
    .eq("building_id", building_id)
    .eq("manager_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json(
      { error: "Samo aktivni upravnik zgrade može zatražiti Premium." },
      { status: 403 },
    );
  }

  const { data: existing } = await supabase
    .from("building_subscriptions")
    .select("id, status, payment_reference")
    .eq("building_id", building_id)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "Zgrada već ima aktivan Premium." }, { status: 409 });
  }

  if (existing?.status === "pending_payment") {
    return NextResponse.json({ payment_reference: existing.payment_reference });
  }

  const paymentReference = `ZGN-${nanoid(8).toUpperCase()}`;

  const { error } = await supabase.from("building_subscriptions").upsert(
    {
      building_id,
      subscribed_by: user.id,
      status: "pending_payment",
      payment_reference: paymentReference,
      amount_rsd: 500,
    },
    { onConflict: "building_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email notifikacija adminu (fire-and-forget)
  void (async () => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) return;
      const [buildingData, profileData] = await Promise.all([
        supabase.from("buildings").select("street, street_number, city").eq("id", building_id).maybeSingle(),
        supabase.from("user_profiles").select("display_name, first_name, last_name").eq("user_id", user.id).maybeSingle(),
      ]);
      const addr = buildingData.data
        ? `${buildingData.data.street} ${buildingData.data.street_number}, ${buildingData.data.city}`
        : building_id;
      const managerName = profileData.data?.display_name
        || [profileData.data?.first_name, profileData.data?.last_name].filter(Boolean).join(" ")
        || "Upravnik";
      await sendPremiumRequestNotification({
        adminEmail,
        buildingAddress: addr,
        managerName,
        paymentReference,
        adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/pretplate`,
      });
    } catch { /* ne blokiramo */ }
  })();

  return NextResponse.json({ payment_reference: paymentReference });
}
