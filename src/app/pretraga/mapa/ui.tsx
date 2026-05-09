"use client";

import { useState } from "react";

type Result = {
  manager_user_id: string;
  building_id: string;
  distance_meters: number;
  profile: {
    user_id: string;
    display_name: string | null;
    city: string | null;
    municipality: string | null;
    professional_manager_status: string;
  } | null;
};

export default function RadiusSearchClient() {
  const [lat, setLat] = useState("44.8125");
  const [lng, setLng] = useState("20.4612");
  const [radius, setRadius] = useState("3000");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  async function search() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/search/radius?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(
          lng,
        )}&radius=${encodeURIComponent(radius)}`,
      );
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setResults(json.results ?? []);
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="lat"
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="lng"
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="radius (m)"
          />
        </div>
        <button
          disabled={busy}
          onClick={search}
          className="mt-3 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
        >
          Pretraži
        </button>
        {msg ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
            {msg}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {results.map((r) => (
          <a
            key={`${r.manager_user_id}-${r.building_id}`}
            href={`/upravnik/${r.manager_user_id}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
          >
            <div className="text-sm font-medium text-zinc-900">
              {r.profile?.display_name ?? r.manager_user_id}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {Math.round(r.distance_meters)} m • building: {r.building_id}
            </div>
          </a>
        ))}
        {!results.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema rezultata (potrebne su zgrade sa lat/lng + aktivni assignment).
          </div>
        ) : null}
      </div>
    </div>
  );
}

