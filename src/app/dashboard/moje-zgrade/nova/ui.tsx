"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type MapboxFeature = {
  id: string;
  place_name: string;
  text: string;
  address?: string;
  center: [number, number]; // [lng, lat]
  context?: { id: string; text: string; short_code?: string }[];
};

type ParsedAddress = {
  mapbox_id: string;
  place_name: string;
  street: string;
  street_number: string;
  city: string;
  municipality: string;
  postal_code: string;
  country: string;
  lat: number;
  lng: number;
};

function parseFeature(f: MapboxFeature): ParsedAddress {
  const ctx = f.context ?? [];
  const get = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix))?.text ?? "";

  return {
    mapbox_id: f.id,
    place_name: f.place_name,
    street: f.text ?? "",
    street_number: f.address ?? "",
    city: get("place") || get("locality"),
    municipality: get("district") || get("region"),
    postal_code: get("postcode"),
    country: get("country") || "Srbija",
    lat: f.center[1],
    lng: f.center[0],
  };
}

export default function NewBuildingClient({ mapboxToken }: { mapboxToken: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [selected, setSelected] = useState<ParsedAddress | null>(null);
  const [entrance, setEntrance] = useState("");
  const [busy, setBusy] = useState(false);
  const [fetchingGeo, setFetchingGeo] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function onQueryChange(val: string) {
    setQuery(val);
    setSelected(null);
    setMsg(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim() || val.length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (!mapboxToken) return;
      setFetchingGeo(true);
      try {
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json`,
        );
        url.searchParams.set("access_token", mapboxToken);
        url.searchParams.set("types", "address");
        url.searchParams.set("country", "RS");
        url.searchParams.set("language", "sr");
        url.searchParams.set("limit", "6");
        const res = await fetch(url.toString());
        const json = (await res.json()) as { features?: MapboxFeature[] };
        setSuggestions(json.features ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setFetchingGeo(false);
      }
    }, 300);
  }

  function pickSuggestion(f: MapboxFeature) {
    const parsed = parseFeature(f);
    setSelected(parsed);
    setQuery(parsed.place_name);
    setSuggestions([]);
    setOpen(false);
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/buildings/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mapbox_id: selected.mapbox_id,
          city: selected.city || "Srbija",
          municipality: selected.municipality || undefined,
          street: selected.street,
          street_number: selected.street_number,
          entrance: entrance.trim() || undefined,
          postal_code: selected.postal_code || undefined,
          country: selected.country,
          latitude: selected.lat,
          longitude: selected.lng,
        }),
      });
      const json = (await res.json()) as { id?: string; duplicate?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Greška");
      setMsg({
        text: json.duplicate
          ? "Zgrada već postoji — dodat si kao član."
          : "Zgrada kreirana i dodat si kao član.",
        ok: true,
      });
      setTimeout(() => router.push(`/zgrade/${json.id}`), 1200);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Greška", ok: false });
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {!mapboxToken && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN nije postavljen — autocomplete ne radi.
        </div>
      )}

      {/* Autocomplete input */}
      <div ref={wrapperRef} className="relative">
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">
          Adresa objekta <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="npr. Bulevar Oslobođenja 102, Novi Sad"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 pr-9 text-sm focus:border-zinc-400 focus:bg-white focus:outline-none"
            autoComplete="off"
          />
          {fetchingGeo && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
              ⏳
            </div>
          )}
        </div>

        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
            {suggestions.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onMouseDown={() => pickSuggestion(f)}
                  className="w-full px-4 py-3 text-left text-sm text-zinc-800 hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                >
                  <span className="font-medium">{f.text} {f.address}</span>
                  <span className="ml-1 text-zinc-400 text-xs">
                    {f.context?.find((c) => c.id.startsWith("place"))?.text ?? ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Odabrana adresa — potvrda */}
      {selected && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="font-medium text-emerald-900">Odabrana adresa</div>
          <div className="mt-2 space-y-1 text-emerald-800">
            <div><span className="text-xs text-emerald-600">Ulica:</span> {selected.street} {selected.street_number}</div>
            <div><span className="text-xs text-emerald-600">Grad:</span> {selected.city}{selected.municipality ? ` (${selected.municipality})` : ""}</div>
            {selected.postal_code && (
              <div><span className="text-xs text-emerald-600">PTT:</span> {selected.postal_code}</div>
            )}
            <div className="text-xs text-emerald-600 font-mono">
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
            </div>
          </div>
        </div>
      )}

      {/* Ulaz (opciono) */}
      {selected && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">
            Ulaz / broj ulaza <span className="text-zinc-400">(opciono)</span>
          </label>
          <input
            type="text"
            value={entrance}
            onChange={(e) => setEntrance(e.target.value)}
            placeholder="npr. A, B, 1, 2..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-zinc-400 focus:bg-white focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Ako zgrada ima više ulaza, unesi oznaku svog ulaza.
          </p>
        </div>
      )}

      {msg && (
        <div className={`rounded-xl border p-3 text-sm ${
          msg.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {msg.text}
        </div>
      )}

      <button
        type="button"
        disabled={!selected || busy}
        onClick={save}
        className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
      >
        {busy ? "Čuvanje..." : "Dodaj ovu zgradu →"}
      </button>

      {!selected && query.length >= 4 && !fetchingGeo && suggestions.length === 0 && (
        <p className="text-center text-xs text-zinc-400">
          Nema rezultata — pokušaj sa punom adresom (ulica + broj + grad)
        </p>
      )}
    </div>
  );
}
