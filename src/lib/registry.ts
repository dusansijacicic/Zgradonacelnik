import { parse } from "csv-parse/sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const REGISTRY_SOURCE = "solidus.csv";
const ACTIVE_STATUS = "Registrovan";

type RegistryRow = {
  registry_key: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  license_number: string | null;
  email: string | null;
  phone: string | null;
  municipality: string | null;
  source_url: string;
  registry_status: string | null;
  is_active: boolean;
  removed_at: string | null;
  last_seen_at: string;
  raw_data: Record<string, unknown>;
};

const clean = (v: string | undefined) => (v ?? "").replace(/^﻿/, "").trim();

function normalizeEmail(raw: string) {
  const e = raw.replace(/\s+/g, "").toLowerCase();
  return /^[^@]+@[^@]+\.[a-z]{2,}$/.test(e) ? e : null;
}

/**
 * Podržava izvoz iz PKS/Solidus (Ime, Prezime, Mesto, Licenca br., Telefon, Email, Status)
 * i generički format (full_name, first_name, last_name, license_number, email, phone, municipality).
 */
export function parseRegistryCsv(text: string, seenAt: string): RegistryRow[] {
  const delimiter = text.split(/\r?\n/, 1)[0]?.includes(";") && !text.split(/\r?\n/, 1)[0]?.includes(",") ? ";" : ",";
  const records = parse(text, {
    columns: (header: string[]) => header.map((h) => clean(h)),
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
    delimiter,
  }) as Record<string, string>[];

  const byKey = new Map<string, RegistryRow>();
  for (const r of records) {
    const first = clean(r["Ime"] ?? r.first_name) || null;
    const last = clean(r["Prezime"] ?? r.last_name) || null;
    const license = clean(r["Licenca br."] ?? r.license_number) || null;
    const emailRaw = clean(r["Email"] ?? r.email);
    const email = emailRaw ? normalizeEmail(emailRaw) : null;
    const phone = clean(r["Telefon"] ?? r.phone).replace(/\s*;\s*/g, "; ") || null;
    const municipality = clean(r["Mesto"] ?? r.municipality) || null;
    const status = clean(r["Status"] ?? r.status) || null;
    const fullName = clean(r.full_name) || [first, last].filter(Boolean).join(" ").trim();
    if (!fullName) continue;

    const key = license
      ? `lic:${license}`
      : email
        ? `email:${email}`
        : `name:${fullName.toLowerCase()}|${(municipality ?? "").toLowerCase()}`;

    const active = status ? status === ACTIVE_STATUS : true;
    byKey.set(key, {
      registry_key: key,
      full_name: fullName,
      first_name: first,
      last_name: last,
      license_number: license,
      email: email ?? (emailRaw || null),
      phone,
      municipality,
      source_url: REGISTRY_SOURCE,
      registry_status: status,
      is_active: active,
      removed_at: active ? null : seenAt,
      last_seen_at: seenAt,
      raw_data: {
        ...r,
        _solidus_status: status,
        _solidus_license_issue: clean(r["Datum izdavanja licence"]) || null,
      },
    });
  }
  return Array.from(byKey.values());
}

export type SyncReport = {
  parsed: number;
  upserted: number;
  activeInFile: number;
  deactivatedMissing: number;
  managersExpired: number;
  skippedDeactivation: boolean;
};

/**
 * Upsert po stabilnom ključu (licenca). NIKAD ne briše redove — recenzije i veze sa zgradama ostaju.
 * Upravnici kojih nema u novom fajlu (ili su "Obrisan iz registra") postaju neaktivni, a njihovi
 * nalozi gube status verifikovanog upravnika.
 */
export async function syncRegistry(text: string, opts: { fullSync: boolean; force?: boolean }): Promise<SyncReport> {
  const admin = createSupabaseAdminClient();
  const seenAt = new Date().toISOString();
  const rows = parseRegistryCsv(text, seenAt);
  if (!rows.length) throw new Error("Fajl nema prepoznatljivih redova (proveri zaglavlje).");

  const activeInFile = rows.filter((r) => r.is_active).length;

  // Zaštita od pogrešnog/delimičnog fajla: ne deaktiviraj masovno bez potvrde.
  let skippedDeactivation = !opts.fullSync;
  if (opts.fullSync && !opts.force) {
    const { count } = await admin
      .from("professional_manager_registry")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if ((count ?? 0) > 50 && activeInFile < (count ?? 0) * 0.8) {
      throw new Error(
        `Novi fajl ima ${activeInFile} aktivnih upravnika, a u bazi ih je ${count}. Ako je to tačno, ponovi uvoz sa opcijom "potvrđujem veliku promenu".`,
      );
    }
  }

  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await admin.from("professional_manager_registry").upsert(chunk, { onConflict: "registry_key" });
    if (error) throw new Error(`Upis nije uspeo posle ${upserted} redova: ${error.message}`);
    upserted += chunk.length;
  }

  let deactivatedMissing = 0;
  if (opts.fullSync) {
    const { data: missing, error } = await admin
      .from("professional_manager_registry")
      .update({ is_active: false, removed_at: seenAt })
      .eq("source_url", REGISTRY_SOURCE)
      .eq("is_active", true)
      .or(`last_seen_at.is.null,last_seen_at.lt.${seenAt}`)
      .select("id");
    if (error) throw new Error(`Deaktivacija nije uspela: ${error.message}`);
    deactivatedMissing = missing?.length ?? 0;
    skippedDeactivation = false;
  }

  // Nalozi vezani za neaktivne redove gube verifikaciju (licenca oduzeta / brisan iz registra).
  const { data: inactiveIds } = await admin.from("professional_manager_registry").select("id").eq("is_active", false);
  let managersExpired = 0;
  const ids = (inactiveIds ?? []).map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) {
    const { data: expired } = await admin
      .from("user_profiles")
      .update({ professional_manager_status: "expired" })
      .in("registry_id", ids.slice(i, i + 500))
      .eq("professional_manager_status", "verified")
      .select("user_id");
    managersExpired += expired?.length ?? 0;
  }

  return { parsed: rows.length, upserted, activeInFile, deactivatedMissing, managersExpired, skippedDeactivation };
}
