"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 250;
const DEBOUNCE_MS = 380;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type RegistryRow = {
  id: number;
  full_name: string;
  municipality: string | null;
  license_number: string | null;
  email: string | null;
  phone: string | null;
  source_url: string | null;
  raw_data: Record<string, unknown> | null;
  platform_user_id: string | null;
  average_rating: number | null;
  review_count: number | null;
  active_buildings_count: number | null;
  historical_buildings_count: number | null;
  last_review_at: string | null;
};

type PlatformRow = {
  user_id: string;
  display_name: string | null;
  city: string | null;
  municipality: string | null;
  professional_manager_status: string;
  average_rating: number | null;
  review_count: number;
  last_review_at: string | null;
};

type BuildingRow = {
  building_id: string;
  city: string | null;
  municipality: string | null;
  street: string | null;
  street_number: string | null;
  manager_user_id: string | null;
  manager_display_name: string | null;
};

const SORT_OPTIONS = [
  { value: "name_asc", label: "Ime (A → Š)" },
  { value: "rating_desc", label: "Prosečna ocena (više prvo)" },
  { value: "reviews_desc", label: "Broj recenzija" },
  { value: "newest_review", label: "Najnovija recenzija" },
] as const;

export default function PretragaPageClient() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, DEBOUNCE_MS);

  const [cityInput, setCityInput] = useState("");
  const debouncedCity = useDebouncedValue(cityInput, DEBOUNCE_MS);

  const [municipality, setMunicipality] = useState("");
  const [municipalityList, setMunicipalityList] = useState<string[]>([]);

  const [registrySort, setRegistrySort] = useState<string>("name_asc");
  const [registryPage, setRegistryPage] = useState(1);
  const [registryRows, setRegistryRows] = useState<RegistryRow[]>([]);
  const [registryTotal, setRegistryTotal] = useState(0);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [registryError, setRegistryError] = useState<string | null>(null);

  const [platformPage, setPlatformPage] = useState(1);
  const [platformVerified, setPlatformVerified] = useState(false);
  const [platformRows, setPlatformRows] = useState<PlatformRow[]>([]);
  const [platformTotal, setPlatformTotal] = useState(0);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [platformError, setPlatformError] = useState<string | null>(null);

  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [buildingsError, setBuildingsError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      const res = await fetch("/api/pretraga/municipalities");
      const j = (await res.json()) as { municipalities?: string[]; error?: string };
      if (!off && res.ok && j.municipalities) setMunicipalityList(j.municipalities);
    })();
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    setRegistryPage(1);
  }, [debouncedSearch, municipality, registrySort]);

  useEffect(() => {
    setPlatformPage(1);
  }, [debouncedSearch, debouncedCity, municipality, platformVerified]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRegistryLoading(true);
      setRegistryError(null);
      const params = new URLSearchParams({
        q: debouncedSearch,
        municipality,
        sort: registrySort,
        page: String(registryPage),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/pretraga/registry?${params}`);
      const j = (await res.json()) as {
        rows?: RegistryRow[];
        total?: number;
        error?: string;
        detail?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setRegistryError(j.detail ?? j.error ?? "Greška");
        setRegistryRows([]);
        setRegistryTotal(0);
      } else {
        setRegistryRows(j.rows ?? []);
        setRegistryTotal(Number(j.total ?? 0));
      }
      setRegistryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, municipality, registrySort, registryPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPlatformLoading(true);
      setPlatformError(null);
      const params = new URLSearchParams({
        q: debouncedSearch,
        city: debouncedCity,
        municipality,
        page: String(platformPage),
        pageSize: String(PAGE_SIZE),
      });
      if (platformVerified) params.set("verified", "1");
      const res = await fetch(`/api/pretraga/platform?${params}`);
      const j = (await res.json()) as {
        rows?: PlatformRow[];
        total?: number;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setPlatformError(j.error ?? "Greška");
        setPlatformRows([]);
        setPlatformTotal(0);
      } else {
        setPlatformRows(j.rows ?? []);
        setPlatformTotal(Number(j.total ?? 0));
      }
      setPlatformLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, debouncedCity, municipality, platformVerified, platformPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/pretraga/buildings");
      const j = (await res.json()) as { rows?: BuildingRow[]; error?: string };
      if (cancelled) return;
      if (!res.ok) setBuildingsError(j.error ?? "Greška");
      else {
        setBuildings(j.rows ?? []);
        setBuildingsError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const registryPages = Math.max(1, Math.ceil(registryTotal / PAGE_SIZE));
  const platformPages = Math.max(1, Math.ceil(platformTotal / PAGE_SIZE));

  const resetFilters = useCallback(() => {
    setSearchInput("");
    setCityInput("");
    setMunicipality("");
    setRegistrySort("name_asc");
    setRegistryPage(1);
    setPlatformPage(1);
    setPlatformVerified(false);
  }, []);

  const statusLabel = useCallback((raw: Record<string, unknown> | null) => {
    const s = raw?.Status ?? raw?.status;
    return typeof s === "string" ? s : null;
  }, []);

  const th = "sticky top-0 z-[1] whitespace-nowrap bg-zinc-100 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 sm:px-3";
  const td = "whitespace-nowrap border-b border-zinc-100 px-2 py-2 align-top text-zinc-800 sm:px-3";

  return (
    <div className="w-full min-w-0 bg-zinc-50 pb-12 pt-4 sm:pt-6">
      <div className="mx-auto w-full max-w-[1600px] min-w-0 px-3 sm:px-4 lg:px-6">
        <header className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            Pretraga upravnika
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
            Državni registar (paginacija {PAGE_SIZE} / str), nalozi na platformi i zgrade sa aktivnim
            upravnikom. Pretraga u registru se osvežava dok kucaš ({DEBOUNCE_MS} ms pauza).
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/pretraga/mapa" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
              Radius (mapa) →
            </Link>
            <Link href="/zgrade" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
              Zgrade →
            </Link>
            <Link href="/admin/vezivanje-model" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
              Kako rade veze (admin) →
            </Link>
          </div>
        </header>

        {/* Filteri — mobile first grid */}
        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Filteri</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 shrink-0 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Resetuj
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:gap-4">
            <label className="flex flex-col gap-1.5 lg:col-span-4">
              <span className="text-xs font-medium text-zinc-600">Ime ili email (uživo)</span>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="npr. Petrović ili @gmail"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 text-sm outline-none ring-emerald-600/30 transition focus:border-emerald-500 focus:bg-white focus:ring-2"
                autoComplete="off"
              />
            </label>

            <label className="flex flex-col gap-1.5 lg:col-span-3">
              <span className="text-xs font-medium text-zinc-600">Opština / mesto (registar)</span>
              <select
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/25"
              >
                <option value="">— Sva mesta —</option>
                {municipalityList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 lg:col-span-2">
              <span className="text-xs font-medium text-zinc-600">Sort (registar)</span>
              <select
                value={registrySort}
                onChange={(e) => setRegistrySort(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/25"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 lg:col-span-3">
              <span className="text-xs font-medium text-zinc-600">Grad (platforma)</span>
              <input
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="npr. Beograd"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-600/25"
              />
            </label>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={platformVerified}
              onChange={(e) => setPlatformVerified(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            Samo verifikovani upravnici (platforma)
          </label>
        </section>

        {/* Registar */}
        <section className="mb-10 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-zinc-100 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Državni registar</h2>
              <p className="text-xs text-zinc-500">
                {registryLoading ? "Učitavanje…" : `${registryTotal} ukupno • strana ${registryPage} / ${registryPages}`}
              </p>
            </div>
            <Pagination
              page={registryPage}
              totalPages={registryPages}
              onPage={setRegistryPage}
              disabled={registryLoading}
            />
          </div>
          {registryError ? (
            <div className="p-4 text-sm text-red-700">{registryError}</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-[1160px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className={`${th} left-0 min-w-[10rem] shadow-[2px_0_0_0_rgb(244_244_245)]`}>Ime</th>
                    <th className={`${th} min-w-[4rem]`}>ID</th>
                    <th className={th}>Mesto</th>
                    <th className={th}>Licenca</th>
                    <th className={th}>Email</th>
                    <th className={th}>Telefon</th>
                    <th className={th}>Ocena</th>
                    <th className={th}>Rec.</th>
                    <th className={th}>Akt. zgr.</th>
                    <th className={th}>Status</th>
                    <th className={th}>Profil</th>
                  </tr>
                </thead>
                <tbody>
                  {registryRows.length === 0 && !registryLoading ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-10 text-center text-zinc-500">
                        Nema rezultata.
                      </td>
                    </tr>
                  ) : (
                    registryRows.map((r) => (
                      <tr key={r.id} className="hover:bg-emerald-50/40">
                        <td className={`${td} sticky left-0 z-0 bg-white font-medium shadow-[2px_0_0_0_rgb(244_244_245)]`}>
                          {r.full_name}
                        </td>
                        <td className={`${td} font-mono text-xs tabular-nums text-zinc-600`}>{r.id}</td>
                        <td className={td}>{r.municipality ?? "—"}</td>
                        <td className={td}>{r.license_number ?? "—"}</td>
                        <td className={`${td} max-w-[14rem] truncate`}>{r.email ?? "—"}</td>
                        <td className={`${td} max-w-[10rem] truncate text-xs`}>{r.phone ?? "—"}</td>
                        <td className={`${td} tabular-nums`}>
                          {r.average_rating != null ? Number(r.average_rating).toFixed(2) : "—"}
                        </td>
                        <td className={`${td} tabular-nums`}>{r.review_count ?? 0}</td>
                        <td className={`${td} tabular-nums text-xs`}>
                          {r.active_buildings_count ?? 0}/{r.historical_buildings_count ?? 0}
                        </td>
                        <td className={`${td} max-w-[8rem] truncate text-xs text-zinc-600`}>
                          {statusLabel(r.raw_data) ?? "—"}
                        </td>
                        <td className={`${td} max-w-[9rem]`}>
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/registar/${r.id}`}
                              className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                            >
                              Registar
                            </Link>
                            {r.platform_user_id ? (
                              <Link
                                href={`/upravnik/${r.platform_user_id}`}
                                className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline"
                              >
                                Platforma
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end border-t border-zinc-100 px-3 py-3 sm:px-4">
            <Pagination
              page={registryPage}
              totalPages={registryPages}
              onPage={setRegistryPage}
              disabled={registryLoading}
            />
          </div>
        </section>

        {/* Platforma */}
        <section className="mb-10 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-zinc-100 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Na platformi</h2>
              <p className="text-xs text-zinc-500">
                Sort po imenu u bazi.{" "}
                {platformLoading ? "Učitavanje…" : `${platformTotal} ukupno • strana ${platformPage} / ${platformPages}`}
              </p>
            </div>
            <Pagination
              page={platformPage}
              totalPages={platformPages}
              onPage={setPlatformPage}
              disabled={platformLoading}
            />
          </div>
          {platformError ? (
            <div className="p-4 text-sm text-red-700">{platformError}</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className={`${th} left-0 min-w-[12rem]`}>Ime</th>
                    <th className={th}>Grad</th>
                    <th className={th}>Opština</th>
                    <th className={th}>Status</th>
                    <th className={th}>Ocena</th>
                    <th className={th}>Rec.</th>
                    <th className={th}>Profil</th>
                  </tr>
                </thead>
                <tbody>
                  {platformRows.length === 0 && !platformLoading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                        Nema prijavljenih upravnika.
                      </td>
                    </tr>
                  ) : (
                    platformRows.map((r) => (
                      <tr key={r.user_id} className="hover:bg-zinc-50">
                        <td className={`${td} sticky left-0 bg-white font-medium`}>{r.display_name ?? "—"}</td>
                        <td className={td}>{r.city ?? "—"}</td>
                        <td className={td}>{r.municipality ?? "—"}</td>
                        <td className={`${td} text-xs`}>{r.professional_manager_status}</td>
                        <td className={`${td} tabular-nums`}>
                          {r.average_rating != null ? Number(r.average_rating).toFixed(2) : "—"}
                        </td>
                        <td className={`${td} tabular-nums`}>{r.review_count}</td>
                        <td className={td}>
                          <Link
                            href={`/upravnik/${r.user_id}`}
                            className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                          >
                            Otvori
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end border-t border-zinc-100 px-3 py-3 sm:px-4">
            <Pagination
              page={platformPage}
              totalPages={platformPages}
              onPage={setPlatformPage}
              disabled={platformLoading}
            />
          </div>
        </section>

        {/* Zgrade */}
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-3 py-4 sm:px-4">
            <h2 className="text-lg font-semibold text-zinc-900">Zgrade sa aktivnim upravnikom</h2>
            <p className="text-xs text-zinc-500">Do 300 aktivnih dodela (bez paginacije u MVP).</p>
          </div>
          {buildingsError ? (
            <div className="p-4 text-sm text-red-700">{buildingsError}</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-[800px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className={th}>Grad</th>
                    <th className={th}>Ulica</th>
                    <th className={th}>Upravnik</th>
                    <th className={th}>Zgrada</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((b) => (
                    <tr key={b.building_id} className="hover:bg-zinc-50">
                      <td className={td}>
                        {b.city ?? "—"}
                        {b.municipality ? (
                          <span className="mt-0.5 block text-xs text-zinc-500">{b.municipality}</span>
                        ) : null}
                      </td>
                      <td className={td}>
                        {b.street ?? "—"} {b.street_number ?? ""}
                      </td>
                      <td className={td}>
                        {b.manager_user_id ? (
                          <Link
                            href={`/upravnik/${b.manager_user_id}`}
                            className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                          >
                            {b.manager_display_name ?? "Upravnik"}
                          </Link>
                        ) : (
                          <span className="font-medium text-zinc-800">{b.manager_display_name ?? "Upravnik"}</span>
                        )}
                      </td>
                      <td className={td}>
                        <Link
                          href={`/zgrade/${b.building_id}`}
                          className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline"
                        >
                          Detalji →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
  disabled,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  disabled?: boolean;
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled || !canPrev}
        onClick={() => onPage(page - 1)}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 disabled:opacity-40"
      >
        ← Preth.
      </button>
      <span className="min-w-[8rem] text-center text-xs text-zinc-600 sm:text-sm">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={disabled || !canNext}
        onClick={() => onPage(page + 1)}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 disabled:opacity-40"
      >
        Sledeća →
      </button>
    </div>
  );
}
