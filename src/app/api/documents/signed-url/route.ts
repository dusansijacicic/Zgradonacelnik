import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  id: z.string().uuid(),
});

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const qs = querySchema.safeParse({ id: url.searchParams.get("id") });
  if (!qs.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // RLS-protected select: only allowed users can see this row
  const { data: doc, error } = await supabase
    .from("building_documents")
    .select("id, file_path")
    .eq("id", qs.data.id)
    .single();
  if (error || !doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "zgradonacelnik-private";
  const admin = createSupabaseAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(bucket)
    .createSignedUrl(doc.file_path, 60 * 10);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}

