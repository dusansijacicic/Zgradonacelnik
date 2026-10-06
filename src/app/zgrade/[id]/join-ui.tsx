"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinBuildingClient({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [role, setRole] = useState("owner");
  const [apartment, setApartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/buildings/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ building_id: buildingId, role, apartment_label: apartment || undefined }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    setBusy(false);
    if (!res.ok) return setError(json.detail ?? json.error ?? "Greška");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="font-bold text-slate-900">Stanuješ u ovoj zgradi?</div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
          <option value="owner">Vlasnik stana</option>
          <option value="tenant">Zakupac</option>
          <option value="resident">Član domaćinstva</option>
        </select>
        <input
          value={apartment}
          onChange={(e) => setApartment(e.target.value)}
          maxLength={20}
          placeholder="Broj stana (opciono)"
          className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
        />
        <button disabled={busy} onClick={join} className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "..." : "Pridruži se"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
