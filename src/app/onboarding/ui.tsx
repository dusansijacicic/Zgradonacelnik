"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { type PickedAddress } from "@/components/AddressAutocomplete";

type Intent = "resident" | "manager" | "other";
type ResidenceRole = "owner" | "tenant" | "resident";

type Props = {
  initialFirstName: string;
  initialLastName: string;
  initialBirthYear: number | null;
  isVerifiedManager: boolean;
  email: string;
};

const inputCls =
  "h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-brand-sky focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-sky/20";

export default function OnboardingClient({
  initialFirstName,
  initialLastName,
  initialBirthYear,
  isVerifiedManager,
  email,
}: Props) {
  const router = useRouter();
  const year = new Date().getFullYear();
  const years = Array.from({ length: 96 }, (_, i) => year - 15 - i);

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [birthYear, setBirthYear] = useState<string>(initialBirthYear ? String(initialBirthYear) : "");
  const [intent, setIntent] = useState<Intent>(isVerifiedManager ? "manager" : "resident");
  const [residenceRole, setResidenceRole] = useState<ResidenceRole>("owner");
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const [entrance, setEntrance] = useState("");
  const [apartment, setApartment] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return setError("Ime i prezime su obavezni.");
    if (!birthYear) return setError("Izaberi godinu rođenja.");
    if (!address) return setError("Izaberi adresu iz liste predloga.");
    if (!consent) return setError("Potrebna je saglasnost sa uslovima i politikom privatnosti.");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_year: Number(birthYear),
          intent,
          residence_role: residenceRole,
          place_id: address.placeId,
          session_token: address.sessionToken,
          entrance: entrance.trim() || undefined,
          apartment_label: apartment.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; next?: string; detail?: string; error?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Greška");
      router.replace(json.next ?? "/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Greška");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="rounded-3xl border border-border-subtle bg-white px-6 py-8 shadow-lg sm:px-8 sm:py-10">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy text-2xl text-white">👋</div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-navy">Još samo par podataka</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Prijavljen kao <span className="font-medium text-zinc-700">{email}</span>
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                Ime <span className="text-red-500">*</span>
              </label>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marko" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                Prezime <span className="text-red-500">*</span>
              </label>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Marković" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
              Godina rođenja <span className="text-red-500">*</span>
            </label>
            <select required value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className={inputCls}>
              <option value="">Izaberi…</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}.
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-600">Kako koristiš platformu?</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "resident", label: "Stanar / vlasnik", icon: "🏠" },
                  { value: "manager", label: "Profesionalni upravnik", icon: "🧑‍💼" },
                  { value: "other", label: "Ostalo", icon: "💼" },
                ] as { value: Intent; label: string; icon: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIntent(opt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition ${
                    intent === opt.value ? "border-brand-navy bg-brand-navy/5" : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className={`text-[11px] font-semibold leading-tight ${intent === opt.value ? "text-brand-navy" : "text-zinc-600"}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            {intent === "manager" && !isVerifiedManager ? (
              <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Posle ovog koraka potvrđuješ da si upravnik preko email adrese iz PKS registra upravnika.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-800">Adresa stanovanja</div>
            <AddressAutocomplete value={address} onChange={setAddress} label="Ulica i broj" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                  Ulaz <span className="font-normal text-zinc-400">(ako ima više)</span>
                </label>
                <input value={entrance} onChange={(e) => setEntrance(e.target.value)} placeholder="A, B, 1…" maxLength={10} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                  Broj stana <span className="font-normal text-zinc-400">(opciono)</span>
                </label>
                <input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="12" maxLength={20} className={inputCls} />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">Po kom osnovu živiš tu?</label>
              <select value={residenceRole} onChange={(e) => setResidenceRole(e.target.value as ResidenceRole)} className={inputCls}>
                <option value="owner">Vlasnik stana</option>
                <option value="tenant">Zakupac</option>
                <option value="resident">Član domaćinstva</option>
              </select>
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              Ako tvoja zgrada još nije na platformi, ti je otvaraš. Članstvo potvrđuje upravnik ili administrator.
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-zinc-600">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-zinc-300" />
            <span>
              Slažem se sa{" "}
              <a href="/uslovi" target="_blank" className="font-medium text-brand-navy underline">
                uslovima korišćenja
              </a>{" "}
              i{" "}
              <a href="/privatnost" target="_blank" className="font-medium text-brand-navy underline">
                politikom privatnosti
              </a>
              . Godište i adresu ne prikazujemo javno.
            </span>
          </label>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-brand-navy text-sm font-bold text-white transition hover:bg-brand-navy-deep disabled:opacity-60"
          >
            {busy ? "Čuvanje..." : "Nastavi na platformu →"}
          </button>
        </form>
      </div>
    </div>
  );
}
