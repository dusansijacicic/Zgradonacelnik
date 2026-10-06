"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Row = { id: number; full_name: string; municipality: string | null; license_number: string | null };

/** Stanar pretraži PKS registar po imenu i označi ko je upravnik zgrade. */
export default function RegistryManagerSuggestClient({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(v: string) {
    setQ(v);
    if (debounce.current) clearTimeout(debounce.current);
    if (v.trim().length < 3) return setRows([]);
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/pretraga/registry?q=${encodeURIComponent(v.trim())}&pageSize=8`);
      const json = (await res.json().catch(() => ({}))) as { rows?: Row[] };
      setRows(json.rows ?? []);
    }, 300);
  }

  async function pick(r: Row) {
    if (!confirm(`Označiti ${r.full_name} kao upravnika ove zgrade?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assignments/registry-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ building_id: buildingId, registry_id: r.id }),
      });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Greška");
      setMsg({ text: "Hvala! Predlog čeka potvrdu administratora.", ok: true });
      setRows([]);
      setQ("");
      router.refresh();
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Greška", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="text-sm font-medium text-slate-900">Znate ko vam je upravnik? Povežite ga.</div>
      <p className="mt-1 text-xs text-slate-600">
        Pretražite registar profesionalnih upravnika (PKS) po imenu i prezimenu ili broju licence.
      </p>
      <input
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder="npr. Petar Petrović"
        className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
      />
      {rows.length ? (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => pick(r)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="font-medium">{r.full_name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {r.municipality ?? ""}
                  {r.license_number ? ` · lic. ${r.license_number}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <div className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</div> : null}
    </div>
  );
}
