import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SOURCE = "solidus.csv";
const BATCH = 400;

function trimKey(k: string) {
  return k.replace(/^\uFEFF/, "").trim();
}

function cell(r: Record<string, string>, ...names: string[]) {
  for (const name of names) {
    const hit = Object.entries(r).find(([k]) => trimKey(k) === name);
    if (hit) {
      const v = hit[1]?.trim();
      if (v) return v;
    }
  }
  return "";
}

function mapSolidusRow(r: Record<string, string>) {
  const first = cell(r, "Ime");
  const last = cell(r, "Prezime");
  const municipality = cell(r, "Mesto");
  const licenseRaw = cell(r, "Licenca br.");
  const license_number = licenseRaw ? licenseRaw : null;
  const phoneRaw = cell(r, "Telefon").replace(/\s*;\s*/g, "; ").trim() || null;
  const emailRaw = cell(r, "Email").trim() || null;
  const status = cell(r, "Status");
  const issueDate = cell(r, "Datum izdavanja licence");
  const rb = cell(r, "R.br");

  const full_name = [first, last].filter(Boolean).join(" ").trim() || emailRaw || `Upravnik ${license_number ?? rb}`;

  return {
    full_name,
    first_name: first || null,
    last_name: last || null,
    license_number,
    email: emailRaw,
    phone: phoneRaw,
    municipality: municipality || null,
    source_url: SOURCE,
    raw_data: {
      ...r,
      _solidus_r_br: rb || null,
      _solidus_status: status || null,
      _solidus_license_issue: issueDate || null,
    },
  };
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: "missing_service_role", detail: "Potreban je SUPABASE_SERVICE_ROLE_KEY za masovni uvoz." },
      { status: 503 },
    );
  }

  const path = join(process.cwd(), "docs", "solidus.csv");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return NextResponse.json(
      { error: "file_not_found", detail: `Nedostaje fajl: docs/solidus.csv` },
      { status: 404 },
    );
  }

  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as Record<string, string>[];

  const rows = records.map(mapSolidusRow).filter((row) => row.full_name.length > 0);

  const { error: delErr, count: deleted } = await admin
    .from("professional_manager_registry")
    .delete({ count: "exact" })
    .eq("source_url", SOURCE);

  if (delErr)
    return NextResponse.json({ error: "db_delete", detail: delErr.message }, { status: 500 });

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error: insErr } = await admin.from("professional_manager_registry").insert(chunk);
    if (insErr)
      return NextResponse.json(
        {
          error: "db_insert",
          detail: insErr.message,
          inserted_partial: inserted,
        },
        { status: 500 },
      );
    inserted += chunk.length;
  }

  return NextResponse.json({
    inserted,
    deleted_previous: deleted ?? 0,
    parsed_rows: records.length,
    source: SOURCE,
  });
}
