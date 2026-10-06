"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvitesClient() {
  const router = useRouter();
  const [limit, setLimit] = useState(20);
  const [mode, setMode] = useState<"first" | "reminder">("first");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function send() {
    if (!confirm(`Poslati do ${limit} ${mode === "first" ? "poziva" : "podsetnika"}?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/registry-invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit, mode }),
    });
    const json = (await res.json().catch(() => ({}))) as { sent?: number; prepared?: number; testMode?: boolean; error?: string; detail?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.detail ?? json.error ?? "Greška" });
    setMsg({
      ok: true,
      text: `Poslato ${json.sent} od ${json.prepared}${json.testMode ? " (TEST mod — sve na test adresu)" : ""}.`,
    });
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-600">Vrsta</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as "first" | "reminder")} className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm">
          <option value="first">Prvi poziv</option>
          <option value="reminder">Podsetnik (30+ dana posle prvog)</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-600">Koliko (max 100)</label>
        <input
          type="number"
          min={1}
          max={100}
          value={limit}
          onChange={(e) => setLimit(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
          className="h-10 w-28 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
        />
      </div>
      <button disabled={busy} onClick={send} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Šaljem..." : "Pošalji"}
      </button>
      {msg ? <div className={`w-full text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</div> : null}
    </div>
  );
}
