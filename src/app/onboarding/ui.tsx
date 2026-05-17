"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserType = "resident" | "other";

const USER_TYPE_OPTIONS: { value: UserType; label: string; description: string }[] = [
  {
    value: "resident",
    label: "Stanar / vlasnik stana",
    description: "Živim u stambenom objektu i pratim rad upravnika",
  },
  {
    value: "other",
    label: "Ostalo",
    description: "Novinar, pravnik, istraživač ili nešto treće",
  },
];

type Props = {
  initialFirstName: string;
  initialLastName: string;
  initialUserType: string;
  initialMunicipality: string;
  initialCity: string;
  email: string;
};

export default function OnboardingClient({
  initialFirstName,
  initialLastName,
  initialUserType,
  initialMunicipality,
  initialCity,
  email,
}: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [userType, setUserType] = useState<UserType>(
    initialUserType === "other" ? "other" : "resident",
  );
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
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), user_type: userType, municipality: municipality.trim() || undefined, city: city.trim() || undefined }),
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
    <div className="w-full max-w-lg">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Dobrodošli na Zgradonačelnik
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Prijavili ste se kao <span className="font-medium text-zinc-700">{email}</span>.
            <br />
            Popunite profil da biste nastavili.
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Ime <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Marko"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Prezime <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Marković"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-700">
              Ko ste vi? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {USER_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    userType === opt.value
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="user_type"
                    value={opt.value}
                    checked={userType === opt.value}
                    onChange={() => setUserType(opt.value)}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{opt.label}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Grad <span className="text-zinc-400">(opciono)</span>
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Beograd"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Opština <span className="text-zinc-400">(opciono)</span>
              </label>
              <input
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="Novi Beograd"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:border-zinc-400 focus:bg-white focus:outline-none"
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
            className="h-12 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {busy ? "Čuvanje..." : "Nastavi →"}
          </button>
        </form>
      </div>
    </div>
  );
}
