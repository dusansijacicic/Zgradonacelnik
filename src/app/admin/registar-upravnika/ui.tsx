"use client";

import { useState } from "react";

export default function RegistryImportClient() {
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
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setMsg(`Import OK: ${json.inserted} redova.`);
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <textarea
        className="h-72 w-full rounded-xl border border-zinc-200 p-3 text-sm"
        placeholder="Nalepi CSV ovde..."
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
      />
      <button
        disabled={busy || csv.trim().length === 0}
        onClick={importCsv}
        className="mt-3 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
      >
        Importuj
      </button>
      {msg ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {msg}
        </div>
      ) : null}
    </div>
  );
}

