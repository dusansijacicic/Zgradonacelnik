import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser, isAdmin, jsonError } from "@/lib/api";
import { syncRegistry } from "@/lib/registry";

export const maxDuration = 60;

/**
 * Sinhronizacija registra upravnika.
 * - multipart: "file" (CSV iz Excel-a: Sačuvaj kao → CSV UTF-8), "full_sync", "force"
 * - bez fajla: uvoz iz docs/solidus.csv u repou
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  if (!(await isAdmin(supabase, user.id))) return jsonError("forbidden", 403);

  let text: string;
  let fullSync = true;
  let force = false;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return jsonError("missing_file", 400, "Izaberi CSV fajl.");
    if (file.size > 20 * 1024 * 1024) return jsonError("file_too_large", 400, "Fajl je veći od 20 MB.");
    if (/\.xlsx?$/i.test(file.name)) {
      return jsonError("xlsx_not_supported", 400, "Sačuvaj Excel kao CSV (UTF-8) pa ga otpremi.");
    }
    text = await file.text();
    fullSync = form.get("full_sync") !== "0";
    force = form.get("force") === "1";
  } else {
    try {
      text = await readFile(join(process.cwd(), "docs", "solidus.csv"), "utf8");
    } catch {
      return jsonError("file_not_found", 404, "Nedostaje docs/solidus.csv na serveru.");
    }
  }

  try {
    const report = await syncRegistry(text, { fullSync, force });
    await supabase.from("audit_log").insert({
      actor_user_id: user.id,
      action: "registry_sync",
      entity_type: "professional_manager_registry",
      metadata: report,
    });
    return NextResponse.json(report);
  } catch (e) {
    return jsonError("sync_failed", 400, e instanceof Error ? e.message : "Greška");
  }
}
