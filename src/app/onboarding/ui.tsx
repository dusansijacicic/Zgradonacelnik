"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserType = "resident" | "other";

type Props = {
  initialFirstName: string;
  initialLastName: string;
  initialUserType: string;
  initialMunicipality: string;
  initialCity: string;
  email: string;
};

export default function OnboardingClient({ initialFirstName, initialLastName, initialUserType, initialMunicipality, initialCity, email }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [userType, setUserType] = useState<UserType>(initialUserType === "other" ? "other" : "resident");
  const [municipality, setMunicipality] = useState(initialMunicipality);
  const [city, setCity] = useState(initialCity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Ime i prezime su obavezni.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          user_type: userType,
          municipality: municipality.trim() || undefined,
          city: city.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Greška");
      router.replace("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Greška");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl border border-border-subtle bg-white px-8 py-10 shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy text-2xl text-white">
            👋
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-navy">
            Dobrodošao na platformu
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Prijavljen kao <span className="font-medium text-zinc-700">{email}</span>
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                Ime <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Marko"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-brand-sky focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-sky/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                Prezime <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Marković"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-brand-sky focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-sky/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-600">
              Kako koristiš platformu?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "resident", label: "Stanar / vlasnik", icon: "🏠" },
                { value: "other",    label: "Ostalo",           icon: "💼" },
              ] as { value: UserType; label: string; icon: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUserType(opt.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition ${
                    userType === opt.value
                      ? "border-brand-navy bg-brand-navy/5"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className={`text-xs font-semibold ${userType === opt.value ? "text-brand-navy" : "text-zinc-600"}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                Grad <span className="text-zinc-400 font-normal">(opciono)</span>
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Beograd"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-brand-sky focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                Opština <span className="text-zinc-400 font-normal">(opciono)</span>
              </label>
              <input
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="Novi Beograd"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-brand-sky focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

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
