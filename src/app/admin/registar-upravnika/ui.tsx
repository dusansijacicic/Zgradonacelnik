"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Report = {
  parsed: number;
  upserted: number;
  activeInFile: number;
  deactivatedMissing: number;
  managersExpired: number;
  skippedDeactivation: boolean;
};

export default function RegistryImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fullSync, setFullSync] = useState(true);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(useBundled: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      let res: Response;
      if (useBundled) {
        res = await fetch("/api/admin/registry-import", { method: "POST" });
      } else {
        if (!file) throw new Error("Izaberi CSV fajl.");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("full_sync", fullSync ? "1" : "0");
        if (force) fd.append("force", "1");
        res = await fetch("/api/admin/registry-import", { method: "POST", body: fd });
      }
      const json = (await res.json()) as Report & { error?: string; detail?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Greška");
      setMsg({
        ok: true,
        text: `Obrađeno ${json.parsed} redova (${json.activeInFile} aktivnih). Deaktivirano jer ih nema u fajlu: ${json.deactivatedMissing}. Nalozi koji su izgubili verifikaciju: ${json.managersExpired}.`,
      });
      router.refresh();
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Greška" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-sm font-semibold text-zinc-900">Novi izvoz registra</div>
      <p className="text-xs text-zinc-600">
        Excel: Datoteka → Sačuvaj kao → „CSV UTF-8“. Kolone: Ime, Prezime, Mesto, Licenca br., Telefon, Email, Status.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-white"
      />
      <label className="flex items-start gap-2 text-xs text-zinc-700">
        <input type="checkbox" checked={fullSync} onChange={(e) => setFullSync(e.target.checked)} className="mt-0.5" />
        Ovo je kompletan registar — deaktiviraj upravnike kojih nema u fajlu
      </label>
      <label className="flex items-start gap-2 text-xs text-zinc-700">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="mt-0.5" />
        Potvrđujem veliku promenu (ako je broj aktivnih pao za više od 20%)
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || !file} onClick={() => run(false)} className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Sinhronizujem..." : "Sinhronizuj iz fajla"}
        </button>
        <button disabled={busy} onClick={() => run(true)} className="h-10 rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-800 disabled:opacity-50">
          Iz docs/solidus.csv (repo)
        </button>
      </div>
      {msg ? (
        <div className={`rounded-lg border p-3 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
