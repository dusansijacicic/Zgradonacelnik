"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Verifikovani upravnik traži da bude potvrđen kao upravnik OVE zgrade (uz dokaz ovlašćenja). */
export default function AssignmentRequestClient({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("building_id", buildingId);
      fd.append("start_date", startDate);
      fd.append("proof", file);
      const res = await fetch("/api/manager/buildings", { method: "POST", body: fd });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Greška");
      setMsg({ text: "Zahtev je poslat. Admin proverava dokaz.", ok: true });
      router.refresh();
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Greška", ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 text-sm font-semibold text-slate-800 underline underline-offset-2">
        Ja upravljam ovom zgradom — zatraži potvrdu
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-medium text-slate-900">Potvrda upravljanja (dokaz: ugovor ili odluka skupštine)</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="date" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <button disabled={busy || !file} onClick={submit} className="mt-3 h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Šaljem..." : "Pošalji zahtev"}
      </button>
      {msg ? <div className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</div> : null}
    </div>
  );
}
