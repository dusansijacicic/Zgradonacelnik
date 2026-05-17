"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type MapboxFeature = {
  id: string;
  place_name: string;
  text: string;
  address?: string;
  center: [number, number];
  context?: { id: string; text: string }[];
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

type ExistingBuilding = { id: string; member_count?: number } | null;

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
  const [existingBuilding, setExistingBuilding] = useState<ExistingBuilding>(undefined as any);
  const [checkingDb, setCheckingDb] = useState(false);
  const [entrance, setEntrance] = useState("");
  const [busy, setBusy] = useState(false);
  const [fetchingGeo, setFetchingGeo] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    setExistingBuilding(undefined as any);
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

  async function pickSuggestion(f: MapboxFeature) {
    const parsed = parseFeature(f);
    setSelected(parsed);
    setQuery(parsed.place_name);
    setSuggestions([]);
    setOpen(false);
    setExistingBuilding(undefined as any);

    // Check if this address already exists in our DB
    setCheckingDb(true);
    try {
      const res = await fetch(
        `/api/buildings/find?mapbox_id=${encodeURIComponent(f.id)}`,
      );
      if (res.ok) {
        const json = (await res.json()) as { building?: ExistingBuilding };
        setExistingBuilding(json.building ?? null);
      } else {
        setExistingBuilding(null);
      }
    } catch {
      setExistingBuilding(null);
    } finally {
      setCheckingDb(false);
    }
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
      setMsg({ text: "Uspešno! Preusmeravamo na stranicu zgrade...", ok: true });
      setTimeout(() => router.push(`/zgrade/${json.id}`), 900);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Greška", ok: false });
      setBusy(false);
    }
  }

  const isNew = selected && existingBuilding === null;
  const isExisting = selected && existingBuilding && existingBuilding !== null;

  return (
    <div className="mt-6 space-y-4">
      {!mapboxToken && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN nije postavljen — autocomplete ne radi.
        </div>
      )}

      {/* Search input */}
      <div ref={wrapperRef} className="relative">
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">
          Traži adresu svog objekta <span className="text-red-500">*</span>
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
          {(fetchingGeo || checkingDb) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 animate-pulse">
              •••
            </div>
          )}
        </div>

        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
            {suggestions.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onMouseDown={() => pickSuggestion(f)}
                  className="w-full border-b border-zinc-100 px-4 py-3 text-left text-sm text-zinc-800 last:border-0 hover:bg-zinc-50"
                >
                  <span className="font-medium">{f.text} {f.address}</span>
                  <span className="ml-1.5 text-xs text-zinc-400">
                    {f.context?.find((c) => c.id.startsWith("place"))?.text ?? ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status kartice */}
      {selected && checkingDb && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 animate-pulse">
          Proveravamo da li zgrada postoji u sistemu...
        </div>
      )}

      {isExisting && !checkingDb && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏢</span>
            <span className="font-semibold text-emerald-900">Zgrada postoji u sistemu</span>
          </div>
          <div className="mt-1 text-emerald-700">{selected.street} {selected.street_number}, {selected.city}</div>
          <div className="mt-2 text-xs text-emerald-600">
            Klikni "Pridruži se" i bićeš dodat kao član — admin će verifikovati tvoje stanovanje.
          </div>
        </div>
      )}

      {isNew && !checkingDb && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <span className="font-semibold text-blue-900">Nova adresa</span>
          </div>
          <div className="mt-1 text-blue-700">{selected.street} {selected.street_number}, {selected.city}</div>
          <div className="mt-1 text-xs text-blue-600 font-mono">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</div>
          <div className="mt-2 text-xs text-blue-600">
            Ova zgrada još ne postoji na platformi. Bićeš prvi koji je registruje.
          </div>
        </div>
      )}

      {/* Ulaz */}
      {selected && !checkingDb && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">
            Ulaz <span className="text-zinc-400">(opciono, ako zgrada ima više ulaza)</span>
          </label>
          <input
            type="text"
            value={entrance}
            onChange={(e) => setEntrance(e.target.value)}
            placeholder="npr. A, B, 1, 2..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-zinc-400 focus:bg-white focus:outline-none"
          />
        </div>
      )}

      {msg && (
        <div className={`rounded-xl border p-3 text-sm ${
          msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {msg.text}
        </div>
      )}

      {selected && !checkingDb && (
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {busy ? "Čuvanje..." : isExisting ? "Pridruži se ovoj zgradi →" : "Registruj zgradu i pridruži se →"}
        </button>
      )}

      {!selected && query.length >= 4 && !fetchingGeo && suggestions.length === 0 && (
        <p className="text-center text-xs text-zinc-400">
          Nema rezultata — pokušaj sa punom adresom (ulica + broj + grad)
        </p>
      )}
    </div>
  );
}
