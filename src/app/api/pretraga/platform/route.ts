import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const city = (url.searchParams.get("city") ?? "").trim().slice(0, 80);
  const municipality = (url.searchParams.get("municipality") ?? "").trim().slice(0, 80);
  const verified = url.searchParams.get("verified") === "1";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(250, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));
  const from = (page - 1) * pageSize;

  const supabase = await createSupabaseServerClient();
  const like = (v: string) => `%${v.replace(/[%_,()]/g, " ")}%`;

  let query = supabase
    .from("manager_public_profiles")
    .select("user_id, display_name, city, municipality, professional_manager_status", { count: "exact" });
  if (verified) query = query.eq("professional_manager_status", "verified");
  if (city) query = query.ilike("city", like(city));
  if (municipality) query = query.ilike("municipality", like(municipality));
  if (q) query = query.ilike("display_name", like(q));

  const { data: managers, error, count } = await query
    .order("display_name", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (managers ?? []).map((m) => m.user_id);
  const { data: stats } = ids.length
    ? await supabase.from("manager_stats").select("manager_user_id, average_rating, review_count, last_review_at").in("manager_user_id", ids)
    : { data: [] as { manager_user_id: string; average_rating: number | null; review_count: number; last_review_at: string | null }[] };
  const statsById = new Map((stats ?? []).map((s) => [s.manager_user_id, s]));

  return NextResponse.json({
    rows: (managers ?? []).map((m) => ({
      ...m,
      average_rating: statsById.get(m.user_id)?.average_rating ?? null,
      review_count: statsById.get(m.user_id)?.review_count ?? 0,
      last_review_at: statsById.get(m.user_id)?.last_review_at ?? null,
    })),
    total: count ?? 0,
    page,
    pageSize,
  });
}
