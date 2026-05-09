"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegistryImportClient() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function importCsv() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/registry-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const json = (await res.json()) as { error?: string; inserted?: number };
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setMsg(`Import OK: ${json.inserted} redova.`);
      router.refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  async function importSolidus() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/registry-import/solidus", { method: "POST" });
      const json = (await res.json()) as {
        error?: string;
        detail?: string;
        inserted?: number;
        deleted_previous?: number;
        parsed_rows?: number;
        inserted_partial?: number;
      };
      if (!res.ok) {
        const hint = json.detail ? ` (${json.detail})` : "";
        throw new Error((json?.error ?? "Greška") + hint);
      }
      setMsg(
        `Solidus: ubačeno ${json.inserted} redova (parsirano ${json.parsed_rows}). ` +
          `Obrisano prethodnih sa istim izvorom: ${json.deleted_previous ?? 0}.`,
      );
      router.refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Uvoz iz projekta (solidus.csv)</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Učitava <span className="font-mono text-xs">docs/solidus.csv</span> — svi redovi (uključujući
          &quot;Obrisan iz registra&quot;). Pre uvoza briše postojeće zapise sa izvorom{" "}
          <span className="font-mono text-xs">solidus.csv</span>. Potreban je{" "}
          <span className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</span>.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={importSolidus}
          className="mt-3 h-11 w-full rounded-xl bg-emerald-700 text-sm font-medium text-white disabled:opacity-60"
        >
          Uvezi sve iz solidus.csv
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Ručni uvoz (nalepi CSV)</h2>
        <textarea
          className="mt-2 h-72 w-full rounded-xl border border-zinc-200 p-3 text-sm"
          placeholder="Nalepi CSV ovde..."
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || csv.trim().length === 0}
          onClick={importCsv}
          className="mt-3 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
        >
          Importuj
        </button>
      </div>

      {msg ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{msg}</div>
      ) : null}
    </div>
  );
}

