import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const city = (url.searchParams.get("city") ?? "").trim();
  const municipality = (url.searchParams.get("municipality") ?? "").trim();
  const verified = url.searchParams.get("verified") === "1";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(250, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "250", 10) || 250));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("user_profiles")
    .select("user_id, display_name, city, municipality, professional_manager_status", {
      count: "exact",
    })
    .eq("user_type", "professional_manager");

  if (verified) query = query.eq("professional_manager_status", "verified");
  if (city) query = query.ilike("city", `%${city}%`);
  if (municipality) query = query.ilike("municipality", `%${municipality}%`);
  if (q) query = query.ilike("display_name", `%${q}%`);

  const { data: managers, error, count } = await query
    .order("display_name", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (managers ?? []).map((m) => m.user_id);
  const { data: stats } = ids.length
    ? await supabase
        .from("manager_stats")
        .select("manager_user_id, average_rating, review_count, last_review_at")
        .in("manager_user_id", ids)
    : { data: [] as { manager_user_id: string; average_rating: number | null; review_count: number | null; last_review_at: string | null }[] };

  const statsById = new Map((stats ?? []).map((s) => [s.manager_user_id, s]));

  const rows =
    (managers ?? []).map((m) => ({
      ...m,
      average_rating: statsById.get(m.user_id)?.average_rating ?? null,
      review_count: statsById.get(m.user_id)?.review_count ?? 0,
      last_review_at: statsById.get(m.user_id)?.last_review_at ?? null,
    })) ?? [];

  return NextResponse.json({
    rows,
    total: count ?? 0,
    page,
    pageSize,
  });
}
