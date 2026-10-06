import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegistryCandidate = {
  id: number;
  full_name: string;
  municipality: string | null;
  license_number: string | null;
  claimed_by: string | null;
};

/** Aktivni redovi registra sa datim emailom (jedan email može imati više licenci — npr. agencija). */
export async function findRegistryByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();

  const { data: rows } = await admin
    .from("professional_manager_registry")
    .select("id, full_name, municipality, license_number, is_active")
    .eq("normalized_email", normalized)
    .order("id", { ascending: false })
    .limit(10);

  const active = (rows ?? []).filter((r) => r.is_active);
  const inactiveOnly = (rows ?? []).length > 0 && active.length === 0;

  const ids = active.map((r) => r.id);
  const { data: owners } = ids.length
    ? await admin.from("user_profiles").select("user_id, registry_id").in("registry_id", ids)
    : { data: [] as { user_id: string; registry_id: number }[] };
  const ownerByRegistry = new Map((owners ?? []).map((o) => [o.registry_id, o.user_id]));

  const candidates: RegistryCandidate[] = active.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    municipality: r.municipality,
    license_number: r.license_number,
    claimed_by: ownerByRegistry.get(r.id) ?? null,
  }));

  return { candidates, inactiveOnly };
}

export async function claimRegistry(userId: string, registryId: number) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("claim_registry_entry", { p_user_id: userId, p_registry_id: registryId });
  if (error) {
    if (error.message.includes("registry_already_claimed")) return { ok: false as const, reason: "already_claimed" as const };
    throw new Error(error.message);
  }
  return { ok: true as const };
}
