import { readFileSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import RegistryImportClient from "./ui";

/** Broj podatkovnih redova u docs/solidus.csv (bez zaglavlja). */
function countSolidusDataRows(): number | null {
  try {
    const raw = readFileSync(join(process.cwd(), "docs", "solidus.csv"), "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return null;
    return Math.max(0, lines.length - 1);
  } catch {
    return null;
  }
}

export default async function AdminRegistryImportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/registar-upravnika");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const expectedSolidusRows = countSolidusDataRows();

  const { count: solidusInDb } = await supabase
    .from("professional_manager_registry")
    .select("*", { count: "exact", head: true })
    .eq("source_url", "solidus.csv");

  const { count: registryTotal } = await supabase
    .from("professional_manager_registry")
    .select("*", { count: "exact", head: true });

  const inDb = solidusInDb ?? 0;
  const total = registryTotal ?? 0;
  const fileRows = expectedSolidusRows;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Import registra profesionalnih upravnika (CSV)
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            MVP: uvoz cele tabele iz <span className="font-mono text-xs">docs/solidus.csv</span> ili ručni
            CSV. Za nalepljeni fajl kolone:{" "}
            <span className="font-medium text-zinc-900">
              full_name, first_name, last_name, license_number, email, phone, municipality
            </span>
            . Solidus koristi kolone: Ime, Prezime, Mesto, Licenca br., Telefon, Email, Status…
          </p>

          {fileRows !== null ? (
            <div className="mt-4 rounded-xl border border-brand-sky/40 bg-brand-sky-muted/60 p-4 text-sm text-brand-navy">
              <p>
                <span className="font-semibold">U bazi</span> sa izvorom{" "}
                <code className="rounded bg-white/80 px-1 text-xs">solidus.csv</code>:{" "}
                <span className="font-semibold tabular-nums">{inDb}</span> redova.
              </p>
              <p className="mt-1">
                <span className="font-semibold">U fajlu</span>{" "}
                <code className="rounded bg-white/80 px-1 text-xs">docs/solidus.csv</code> (bez
                zaglavlja): <span className="font-semibold tabular-nums">{fileRows}</span> redova.
              </p>
              {inDb === fileRows ? (
                <p className="mt-2 font-medium text-brand-green">Broj u bazi odgovara fajlu.</p>
              ) : inDb === 0 ? (
                <p className="mt-2 text-amber-800">
                  Još nema uvoza iz Solidusa (ili su svi obrisani). Klikni „Uvezi sve iz solidus.csv“.
                </p>
              ) : (
                <p className="mt-2 text-amber-800">
                  Broj u bazi ({inDb}) ne odgovara fajlu ({fileRows}). Ponovi uvoz ili proveri log na
                  serveru.
                </p>
              )}
              <p className="mt-2 text-brand-navy/85">
                Ukupno u registru (svi izvori):{" "}
                <span className="font-semibold tabular-nums">{total}</span>
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Na serveru nije pronađen <code className="text-xs">docs/solidus.csv</code> — uporedi
              lokalno ili proveri deploy (fajl mora biti u repou).
            </div>
          )}

          <RegistryImportClient />
        </div>
      </main>
    </div>
  );
}

