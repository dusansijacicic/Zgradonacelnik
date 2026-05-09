import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SORTS = new Set(["name_asc", "rating_desc", "reviews_desc", "newest_review"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const municipality = (url.searchParams.get("municipality") ?? "").trim();
  const sortRaw = (url.searchParams.get("sort") ?? "name_asc").trim();
  const sort = SORTS.has(sortRaw) ? sortRaw : "name_asc";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(250, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "250", 10) || 250));
  const offset = (page - 1) * pageSize;

  const supabase = await createSupabaseServerClient();

  const [{ data: rows, error: rowErr }, { data: countRaw, error: countErr }] = await Promise.all([
    supabase.rpc("rpc_pretraga_registry", {
      p_q: q,
      p_municipality: municipality,
      p_limit: pageSize,
      p_offset: offset,
      p_sort: sort,
    }),
    supabase.rpc("rpc_pretraga_registry_count", {
      p_q: q,
      p_municipality: municipality,
    }),
  ]);

  if (rowErr || countErr) {
    const msg = rowErr?.message ?? countErr?.message ?? "rpc_error";
    return NextResponse.json(
        { error: "pretraga_registry", detail: msg },
        { status: rowErr?.message?.includes("function") ? 503 : 500 },
      );
  }

  const total = typeof countRaw === "number" ? countRaw : Number(countRaw ?? 0);

  return NextResponse.json({
    rows: rows ?? [],
    total,
    page,
    pageSize,
    sort,
  });
}
