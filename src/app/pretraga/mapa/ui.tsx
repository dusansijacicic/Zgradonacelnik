"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

type ManagerResult = {
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
  building?: {
    latitude: number | null;
    longitude: number | null;
    street: string | null;
    street_number: string | null;
  };
};

type Props = {
  mapboxToken: string;
};

export default function MapaClient({ mapboxToken }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);

  const [lat, setLat] = useState("44.8125");
  const [lng, setLng] = useState("20.4612");
  const [radius, setRadius] = useState("3000");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ManagerResult[]>([]);
  const [selected, setSelected] = useState<ManagerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current) return;

    let map: any;
    let aborted = false;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (aborted || !mapContainer.current) return;

      mapboxgl.accessToken = mapboxToken;
      map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [parseFloat(lng), parseFloat(lat)],
        zoom: 12,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
          showUserHeading: false,
        }),
        "top-right",
      );

      map.on("load", () => {
        if (!aborted) {
          mapRef.current = map;
          setMapReady(true);
        }
      });
    });

    return () => {
      aborted = true;
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  const clearMarkers = useCallback(() => {
    for (const m of markersRef.current) {
      (m as any).remove();
    }
    markersRef.current = [];
  }, []);

  const addMarkers = useCallback(
    async (items: ManagerResult[]) => {
      const { default: mapboxgl } = await import("mapbox-gl");
      clearMarkers();
      const map = mapRef.current as any;
      if (!map) return;

      const bounds = new mapboxgl.LngLatBounds();
      let hasCoords = false;

      for (const r of items) {
        const bLat = r.building?.latitude;
        const bLng = r.building?.longitude;
        if (!bLat || !bLng) continue;

        hasCoords = true;
        bounds.extend([bLng, bLat]);

        const el = document.createElement("div");
        el.className = "cursor-pointer";
        el.innerHTML = `<div style="background:#18181b;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">★</div>`;
        el.addEventListener("click", () => setSelected(r));

        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
          `<div style="font-size:13px;font-weight:600">${r.profile?.display_name ?? "Upravnik"}</div>
           <div style="font-size:11px;color:#666;margin-top:2px">${r.building?.street ?? ""} ${r.building?.street_number ?? ""}</div>
           <div style="font-size:11px;color:#888;margin-top:1px">${Math.round(r.distance_meters)} m</div>`,
        );

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([bLng, bLat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      }

      if (hasCoords) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
      }
    },
    [clearMarkers],
  );

  async function search() {
    setBusy(true);
    setError(null);
    setSelected(null);
    try {
      const res = await fetch(
        `/api/search/radius?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${encodeURIComponent(radius)}`,
      );
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      const items: ManagerResult[] = json.results ?? [];
      setResults(items);
      if (mapReady) await addMarkers(items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Vaš pregledač ne podržava geolokaciju.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude.toFixed(6);
        const newLng = pos.coords.longitude.toFixed(6);
        setLat(newLat);
        setLng(newLng);
        const map = mapRef.current as any;
        if (map) map.flyTo({ center: [parseFloat(newLng), parseFloat(newLat)], zoom: 13 });
      },
      () => setError("Nije moguće dobiti vašu lokaciju."),
    );
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row gap-0">
      {/* Sidebar */}
      <div className="w-full lg:w-80 shrink-0 border-r border-zinc-200 bg-white flex flex-col">
        <div className="p-4 border-b border-zinc-100">
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Lat (44.81)"
              />
              <input
                className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Lng (20.46)"
              />
            </div>
            <select
              className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            >
              <option value="500">500 m</option>
              <option value="1000">1 km</option>
              <option value="3000">3 km</option>
              <option value="5000">5 km</option>
              <option value="10000">10 km</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={useMyLocation}
                className="flex-1 h-9 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                📍 Moja lokacija
              </button>
              <button
                disabled={busy}
                onClick={search}
                className="flex-1 h-9 rounded-lg bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
              >
                {busy ? "Traži..." : "Pretraži"}
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto">
          {results.length === 0 && !busy && (
            <div className="p-4 text-xs text-zinc-400 text-center">
              Unesite lokaciju i kliknite Pretraži
            </div>
          )}
          {results.map((r) => (
            <button
              key={`${r.manager_user_id}-${r.building_id}`}
              onClick={() => setSelected(r)}
              className={`w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                selected?.manager_user_id === r.manager_user_id ? "bg-zinc-100" : ""
              }`}
            >
              <div className="text-sm font-medium text-zinc-900 truncate">
                {r.profile?.display_name ?? "Nepoznat"}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {Math.round(r.distance_meters)} m •{" "}
                {r.profile?.municipality ?? r.profile?.city ?? "—"}
              </div>
            </button>
          ))}
        </div>

        {/* Selected manager detail */}
        {selected && (
          <div className="p-4 border-t border-zinc-200 bg-zinc-50">
            <div className="text-sm font-semibold text-zinc-900">
              {selected.profile?.display_name ?? "—"}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {Math.round(selected.distance_meters)} m od tražene lokacije
            </div>
            <Link
              href={`/upravnik/${selected.manager_user_id}`}
              className="mt-3 block h-9 w-full rounded-lg bg-zinc-900 text-center text-xs font-medium leading-9 text-white hover:bg-zinc-700"
            >
              Pogledaj profil →
            </Link>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative" style={{ minHeight: "400px" }}>
        {!mapboxToken && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN nije postavljen.
          </div>
        )}
        <div ref={mapContainer} className="absolute inset-0" />
      </div>
    </div>
  );
}
