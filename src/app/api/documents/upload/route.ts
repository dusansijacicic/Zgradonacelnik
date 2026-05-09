import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rateLimit";

const querySchema = z.object({
  building_id: z.string().uuid().optional(),
  document_type: z
    .enum([
      "invoice",
      "receipt",
      "contract",
      "meeting_minutes",
      "decision",
      "bank_statement",
      "photo",
      "other",
    ])
    .optional(),
  visibility: z.enum(["residents_only", "managers_only", "public", "private"]).optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await enforceRateLimit({ action: "document_upload", limit: 20, windowSeconds: 3600 });

  const url = new URL(request.url);
  const qs = querySchema.safeParse({
    building_id: url.searchParams.get("building_id") ?? undefined,
    document_type: url.searchParams.get("document_type") ?? undefined,
    visibility: url.searchParams.get("visibility") ?? undefined,
  });
  if (!qs.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "");
  const description = String(form.get("description") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "zgradonacelnik-private";
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const filePath = `${user.id}/${Date.now()}-${nanoid(10)}.${ext}`;

  const admin = createSupabaseAdminClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(filePath, Buffer.from(arrayBuffer), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (upErr) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data: docRow, error: docErr } = await supabase
    .from("building_documents")
    .insert({
      building_id: qs.data.building_id ?? null,
      uploaded_by: user.id,
      document_type: qs.data.document_type ?? "other",
      title: title || null,
      description: description || null,
      file_path: filePath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      visibility: qs.data.visibility ?? "private",
    })
    .select("id, file_path")
    .single();

  if (docErr) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "document_upload",
    entity_type: "building_documents",
    entity_id: docRow.id,
    metadata: { building_id: qs.data.building_id ?? null, bucket },
  });

  return NextResponse.json({ id: docRow.id });
}

