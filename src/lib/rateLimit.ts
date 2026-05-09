import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function enforceRateLimit(params: {
  action: string;
  limit: number;
  windowSeconds: number;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rate_limit_check", {
    p_action: params.action,
    p_limit: params.limit,
    p_window_seconds: params.windowSeconds,
  });
  if (error) throw new Error("rate_limit_error");
  if (!data) throw new Error("rate_limited");
}

