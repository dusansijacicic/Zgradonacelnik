"use client";

import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  price_monthly: string;
  max_buildings: number | null;
  features: any;
  active: boolean;
};

export default function AdminPlansClient({ initial }: { initial: Plan[] }) {
  const [rows, setRows] = useState<Plan[]>(initial);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [maxBuildings, setMaxBuildings] = useState<string>("");
  const [features, setFeatures] = useState<string>('{"features":["search","reviews"]}');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/plans/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          price_monthly: Number(price),
          max_buildings: maxBuildings ? Number(maxBuildings) : null,
          features: JSON.parse(features),
          active: true,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setRows((prev) => [json.row, ...prev]);
      setName("");
      setPrice("0");
      setMaxBuildings("");
      setMsg("Plan dodat.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-medium text-zinc-900">Novi plan</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Naziv"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Cena mesečno (RSD)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Max zgrada (opciono)"
            value={maxBuildings}
            onChange={(e) => setMaxBuildings(e.target.value)}
          />
          <div className="text-xs text-zinc-500 self-center">
            Features JSON (MVP)
          </div>
        </div>
        <textarea
          className="mt-3 h-28 w-full rounded-xl border border-zinc-200 p-3 text-sm"
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
        />
        <button
          disabled={busy}
          onClick={create}
          className="mt-3 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
        >
          Dodaj plan
        </button>
        {msg ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            {msg}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((p) => (
          <div key={p.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="text-sm font-medium text-zinc-900">{p.name}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {p.price_monthly} RSD • max: {p.max_buildings ?? "—"} •{" "}
              {p.active ? "active" : "inactive"}
            </div>
            <pre className="mt-3 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
              {JSON.stringify(p.features ?? {}, null, 2)}
            </pre>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema planova.
          </div>
        ) : null}
      </div>
    </div>
  );
}

