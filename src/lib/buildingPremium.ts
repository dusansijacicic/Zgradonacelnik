import type { SupabaseClient } from "@supabase/supabase-js";

export async function isBuildingPremium(
  supabase: SupabaseClient,
  buildingId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("building_subscriptions")
    .select("status")
    .eq("building_id", buildingId)
    .eq("status", "active")
    .maybeSingle();
  return data !== null;
}

export type BuildingSubscription = {
  id: string;
  building_id: string;
  status: "active" | "pending_payment" | "expired" | "cancelled" | "inactive";
  payment_reference: string | null;
  amount_rsd: number;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
};

export async function getBuildingSubscription(
  supabase: SupabaseClient,
  buildingId: string,
): Promise<BuildingSubscription | null> {
  const { data } = await supabase
    .from("building_subscriptions")
    .select("id, building_id, status, payment_reference, amount_rsd, current_period_start, current_period_end, created_at")
    .eq("building_id", buildingId)
    .maybeSingle();
  return data ?? null;
}
