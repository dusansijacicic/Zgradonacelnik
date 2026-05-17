import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendMembershipRequestNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const buildingId = formData.get("building_id") as string | null;
  const note = formData.get("note") as string | null;

  if (!file || !buildingId) {
    return NextResponse.json({ error: "file i building_id su obavezni" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Fajl ne sme biti veći od 10MB" }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Dozvoljeni formati: JPEG, PNG, WebP, PDF" }, { status: 400 });
  }

  // Check membership exists
  const { data: membership } = await supabase
    .from("building_memberships")
    .select("id, verification_status")
    .eq("building_id", buildingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Niste član ove zgrade." }, { status: 403 });
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "zgradonacelnik-private";
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `membership-proofs/${buildingId}/${user.id}-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("building_memberships")
    .update({
      proof_document_path: path,
      proof_uploaded_at: new Date().toISOString(),
      proof_note: note?.trim() || null,
      verification_status: "pending",
    })
    .eq("id", membership.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Notifikacija adminu (fire-and-forget)
  void (async () => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) return;
      const [buildingData, profileData] = await Promise.all([
        supabase.from("buildings").select("street, street_number, city").eq("id", buildingId).maybeSingle(),
        supabase.from("user_profiles").select("display_name, first_name, last_name").eq("user_id", user.id).maybeSingle(),
      ]);
      const addr = buildingData.data
        ? `${buildingData.data.street} ${buildingData.data.street_number}, ${buildingData.data.city}`
        : buildingId;
      const userName = profileData.data?.display_name
        || [profileData.data?.first_name, profileData.data?.last_name].filter(Boolean).join(" ")
        || (user.email ?? "Korisnik");
      await sendMembershipRequestNotification({
        adminEmail,
        userName,
        buildingAddress: addr,
        role: "stanar (dokaz priložen)",
        adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/zgrade-upravnici`,
      });
    } catch { /* ne blokiramo */ }
  })();

  return NextResponse.json({ ok: true, path });
}
