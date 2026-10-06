import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isAdmin, jsonError, rateLimit } from "@/lib/api";
import { storeBuildingDocument, validateUpload } from "@/lib/uploads";

const querySchema = z.object({
  building_id: z.string().uuid().optional(),
  document_type: z
    .enum(["invoice", "receipt", "contract", "meeting_minutes", "decision", "bank_statement", "photo", "other"])
    .optional(),
  visibility: z.enum(["residents_only", "managers_only", "public", "private"]).optional(),
});

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);

  const limited = await rateLimit(supabase, "document_upload", 20, 3600);
  if (limited) return limited;

  const url = new URL(request.url);
  const qs = querySchema.safeParse({
    building_id: url.searchParams.get("building_id") ?? undefined,
    document_type: url.searchParams.get("document_type") ?? undefined,
    visibility: url.searchParams.get("visibility") ?? undefined,
  });
  if (!qs.success) return jsonError("bad_request", 400);
  const visibility = qs.data.visibility ?? "private";

  // Dokument vidljiv drugima (stanari/javno) sme da doda samo aktivni upravnik zgrade ili admin.
  if (visibility !== "private") {
    if (!qs.data.building_id) return jsonError("bad_request", 400);
    const { data: isMgr } = await supabase.rpc("is_active_manager", { building: qs.data.building_id });
    if (!isMgr && !(await isAdmin(supabase, user.id))) {
      return jsonError("forbidden", 403, "Dokumente za stanare objavljuje upravnik zgrade.");
    }
  }

  const form = await request.formData();
  const upload = validateUpload(form.get("file"));
  if (!upload.ok) return jsonError("bad_file", 400, upload.error);

  let id: string;
  try {
    id = await storeBuildingDocument({
      userId: user.id,
      buildingId: qs.data.building_id ?? null,
      file: upload.file,
      ext: upload.ext,
      documentType: qs.data.document_type ?? "other",
      visibility,
      title: String(form.get("title") ?? "").slice(0, 200) || null,
      description: String(form.get("description") ?? "").slice(0, 2000) || null,
    });
  } catch {
    return jsonError("upload_failed", 500, "Upload nije uspeo.");
  }

  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "document_upload",
    entity_type: "building_documents",
    entity_id: id,
    metadata: { building_id: qs.data.building_id ?? null, visibility },
  });

  return NextResponse.json({ id });
}
