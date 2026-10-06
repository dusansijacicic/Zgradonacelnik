"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { type PickedAddress } from "@/components/AddressAutocomplete";

export default function NewBuildingClient() {
  const router = useRouter();
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const [entrance, setEntrance] = useState("");
  const [apartment, setApartment] = useState("");
  const [role, setRole] = useState("owner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!address) return setError("Izaberi adresu iz liste.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/buildings/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          place_id: address.placeId,
          session_token: address.sessionToken,
          entrance: entrance.trim() || undefined,
          apartment_label: apartment.trim() || undefined,
          role,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string; detail?: string };
      if (!res.ok || !json.id) throw new Error(json.detail ?? json.error ?? "Greška");
      router.push(`/zgrade/${json.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Greška");
      setBusy(false);
    }
  }

  const inputCls = "h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:bg-white focus:outline-none";

  return (
    <div className="mt-6 space-y-4">
      <AddressAutocomplete value={address} onChange={setAddress} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">Ulaz (opciono)</label>
          <input value={entrance} onChange={(e) => setEntrance(e.target.value)} maxLength={10} placeholder="A, B, 1…" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">Broj stana</label>
          <input value={apartment} onChange={(e) => setApartment(e.target.value)} maxLength={20} placeholder="12" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">Svojstvo</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="owner">Vlasnik</option>
            <option value="tenant">Zakupac</option>
            <option value="resident">Član domaćinstva</option>
          </select>
        </div>
      </div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <button
        type="button"
        disabled={busy || !address}
        onClick={save}
        className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
      >
        {busy ? "Čuvanje..." : "Pridruži se zgradi →"}
      </button>
    </div>
  );
}
