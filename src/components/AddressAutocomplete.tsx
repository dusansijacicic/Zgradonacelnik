"use client";

import { useEffect, useRef, useState } from "react";

export type PickedAddress = {
  placeId: string;
  label: string;
  sessionToken: string;
};

type Suggestion = { placeId: string; main: string; secondary: string };

function newSessionToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Pretraga adrese preko Google Places (server proxy). Zgrada se pravi tek kad korisnik
 * pošalje formu — server tada ponovo proverava adresu kod Google-a.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "npr. Bulevar oslobođenja 102, Novi Sad",
  label = "Adresa zgrade",
}: {
  value: PickedAddress | null;
  onChange: (v: PickedAddress | null) => void;
  placeholder?: string;
  label?: string;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string>(newSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function onInput(v: string) {
    setQuery(v);
    if (value) onChange(null);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/address/autocomplete?q=${encodeURIComponent(v)}&session=${encodeURIComponent(sessionRef.current)}`,
        );
        const json = (await res.json()) as { suggestions?: Suggestion[]; error?: string; detail?: string };
        if (!res.ok) {
          setError(
            json.error === "places_not_configured"
              ? "Pretraga adresa nije podešena (GOOGLE_MAPS_API_KEY)."
              : "Pretraga adresa trenutno ne radi. Pokušaj ponovo.",
          );
          setSuggestions([]);
          return;
        }
        setSuggestions(json.suggestions ?? []);
        setOpen(true);
      } catch {
        setError("Pretraga adresa trenutno ne radi. Pokušaj ponovo.");
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function pick(s: Suggestion) {
    const label = [s.main, s.secondary].filter(Boolean).join(", ");
    setQuery(label);
    setSuggestions([]);
    setOpen(false);
    onChange({ placeId: s.placeId, label, sessionToken: sessionRef.current });
    // Sledeća pretraga = nova Google sesija.
    sessionRef.current = newSessionToken();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => onInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`h-11 w-full rounded-xl border bg-zinc-50 px-3 pr-9 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-sky/20 ${
            value ? "border-emerald-300" : "border-zinc-200 focus:border-brand-sky"
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
          {loading ? <span className="animate-pulse text-zinc-400">•••</span> : value ? <span className="text-emerald-600">✓</span> : null}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                className="w-full border-b border-zinc-100 px-4 py-3 text-left text-sm text-zinc-800 last:border-0 hover:bg-zinc-50"
              >
                <span className="font-medium">{s.main}</span>
                {s.secondary ? <span className="ml-1.5 text-xs text-zinc-400">{s.secondary}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= 3 && suggestions.length === 0 && !error ? (
        <p className="mt-1.5 text-xs text-zinc-400">Nema rezultata — upiši ulicu, broj i grad.</p>
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
