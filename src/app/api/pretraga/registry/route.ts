import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const SORTS = new Set(["name_asc", "rating_desc", "reviews_desc", "newest_review"]);

/** Javna pretraga registra. Keš na CDN-u: isti upit u narednih 5 min stiže iz keša. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const municipality = (url.searchParams.get("municipality") ?? "").trim().slice(0, 80);
  const sortRaw = (url.searchParams.get("sort") ?? "name_asc").trim();
  const sort = SORTS.has(sortRaw) ? sortRaw : "name_asc";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(250, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.rpc("rpc_pretraga_registry", {
    p_q: q,
    p_municipality: municipality,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
    p_sort: sort,
  });

  if (error) {
    return NextResponse.json({ error: "pretraga_registry", detail: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ({ total_count?: number } & Record<string, unknown>)[];
  let total = rows.length ? Number(rows[0].total_count ?? 0) : 0;
  // Dok migracija 0012 nije pokrenuta, stara funkcija ne vraća total_count.
  if (rows.length && rows[0].total_count === undefined) {
    const { data: count } = await supabase.rpc("rpc_pretraga_registry_count", { p_q: q, p_municipality: municipality });
    total = Number(count ?? 0);
  }

  return NextResponse.json(
    {
      rows: rows.map((r) => {
        const copy = { ...r };
        delete copy.total_count;
        return copy;
      }),
      total,
      page,
      pageSize,
      sort,
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } },
  );
}
