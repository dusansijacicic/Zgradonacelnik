import { nanoid } from "nanoid";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "zgradonacelnik-private";

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

/** Ekstenziju određuje MIME tip (ne ime fajla), pa se ne može podmetnuti .html/.svg. */
export function validateUpload(file: unknown, maxMb = 15): { ok: true; file: File; ext: string } | { ok: false; error: string } {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fajl je obavezan." };
  if (file.size > maxMb * 1024 * 1024) return { ok: false, error: `Fajl ne sme biti veći od ${maxMb} MB.` };
  const ext = MIME_EXT[file.type];
  if (!ext) return { ok: false, error: "Dozvoljeni formati: PDF, JPG, PNG, WebP, DOCX, XLSX." };
  return { ok: true, file, ext };
}

export async function storePrivateFile(prefix: string, file: File, ext: string) {
  const admin = createSupabaseAdminClient();
  const path = `${prefix}/${Date.now()}-${nanoid(10)}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error(`upload_failed: ${error.message}`);
  return path;
}

/** Dokaz (ugovor/odluka) — privatan dokument vezan za zgradu. */
export async function storeBuildingDocument(params: {
  userId: string;
  buildingId: string | null;
  file: File;
  ext: string;
  documentType: "invoice" | "receipt" | "contract" | "meeting_minutes" | "decision" | "bank_statement" | "photo" | "other";
  visibility: "residents_only" | "managers_only" | "public" | "private";
  title?: string | null;
  description?: string | null;
}) {
  const path = await storePrivateFile(params.userId, params.file, params.ext);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("building_documents")
    .insert({
      building_id: params.buildingId,
      uploaded_by: params.userId,
      document_type: params.documentType,
      title: params.title || null,
      description: params.description || null,
      file_path: path,
      file_name: params.file.name.slice(0, 200),
      mime_type: params.file.type,
      file_size: params.file.size,
      visibility: params.visibility,
    })
    .select("id")
    .single();
  if (error || !data) {
    await admin.storage.from(BUCKET).remove([path]);
    throw new Error(`document_insert_failed: ${error?.message}`);
  }
  return data.id as string;
}
