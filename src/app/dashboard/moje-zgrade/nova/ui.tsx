"use client";

import { useState } from "react";

export default function NewBuildingClient() {
  const [city, setCity] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [entrance, setEntrance] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    setBuildingId(null);
    try {
      const res = await fetch("/api/buildings/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          city,
          municipality,
          street,
          street_number: streetNumber,
          entrance,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setBuildingId(json.id);
      setMsg(json.duplicate ? "Zgrada već postoji — povezan si kao član." : "Zgrada kreirana i povezan si kao član.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-3">
      <input
        className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
        placeholder="Grad (npr. Beograd)"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <input
        className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
        placeholder="Opština (opciono)"
        value={municipality}
        onChange={(e) => setMunicipality(e.target.value)}
      />
      <input
        className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
        placeholder="Ulica"
        value={street}
        onChange={(e) => setStreet(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
          placeholder="Broj"
          value={streetNumber}
          onChange={(e) => setStreetNumber(e.target.value)}
        />
        <input
          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
          placeholder="Ulaz (opciono)"
          value={entrance}
          onChange={(e) => setEntrance(e.target.value)}
        />
      </div>
      <button
        disabled={busy}
        onClick={create}
        className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
      >
        Sačuvaj
      </button>

      {msg ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {msg}
          {buildingId ? (
            <div className="mt-2">
              <a className="underline underline-offset-4" href={`/zgrade/${buildingId}`}>
                Otvori zgradu →
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

