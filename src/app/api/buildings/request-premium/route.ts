import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { building_id } = (await request.json()) as { building_id?: string };
  if (!building_id) return NextResponse.json({ error: "building_id required" }, { status: 400 });

  // Verify caller is active manager of this building
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

  // Check if subscription already exists
  const { data: existing } = await supabase
    .from("building_subscriptions")
    .select("id, status, payment_reference")
    .eq("building_id", building_id)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "Zgrada već ima aktivan Premium." }, { status: 409 });
  }

  // If already pending, return existing reference
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ payment_reference: paymentReference });
}
