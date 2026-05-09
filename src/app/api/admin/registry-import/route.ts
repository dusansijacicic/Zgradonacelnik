import { NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  csv: z.string().min(1),
});

export async function POST(request: Request) {
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

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const records = parse(body.data.csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const rows = records.map((r) => ({
    full_name: r.full_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    license_number: r.license_number ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    municipality: r.municipality ?? null,
    source_url: r.source_url ?? "manual_import",
    raw_data: r,
  }));

  const { error } = await supabase
    .from("professional_manager_registry")
    .insert(rows);

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({ inserted: rows.length });
}

