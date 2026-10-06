import type { SupabaseClient } from "@supabase/supabase-js";

/** Premium = status active I period nije istekao (proverava baza, ne klijent). */
export async function isBuildingPremium(supabase: SupabaseClient, buildingId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_building_premium", { p_building: buildingId });
  if (error) return false;
  return data === true;
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
  if (!data) return null;
  // Istekao period se prikazuje kao istekao i pre nego što ga cron označi.
  if (data.status === "active" && data.current_period_end && new Date(data.current_period_end) < new Date()) {
    return { ...data, status: "expired" };
  }
  return data;
}
