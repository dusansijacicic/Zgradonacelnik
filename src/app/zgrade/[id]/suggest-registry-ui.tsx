"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegistryManagerSuggestClient({ buildingId }: { buildingId: string }) {
  const [registryId, setRegistryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    const n = Number.parseInt(registryId.trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      setMsg("Unesi validan ID iz registra (ceo broj).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assignments/registry-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ building_id: buildingId, registry_id: n }),
      });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(json?.detail ?? json?.error ?? "Greška");
      setMsg(
        "Predlog je poslat (pending). Admin treba da odobri. Posle toga možeš ostaviti recenziju vezanu za zgradu.",
      );
      setRegistryId("");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="text-sm font-medium text-zinc-900">Uvezi upravnika iz registra (bez naloga)</div>
      <p className="mt-1 text-sm text-zinc-600">
        Ako si <span className="font-medium">verifikovan</span> član ove zgrade, možeš predložiti red iz
        državnog registra kao upravnika. ID pronađeš u pretrazi registra (
        <Link href="/pretraga" className="font-medium text-emerald-900 underline-offset-2 hover:underline">
          /pretraga
        </Link>
        , kolona ID ili link „Registar“).
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="number"
          min={1}
          placeholder="ID u registru"
          value={registryId}
          onChange={(e) => setRegistryId(e.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm sm:max-w-xs"
        />
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="h-11 shrink-0 rounded-xl bg-emerald-800 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          Pošalji predlog
        </button>
      </div>
      {registryId.trim() && Number.parseInt(registryId, 10) > 0 ? (
        <p className="mt-2 text-xs text-zinc-600">
          Recenzija vezana za ovu zgradu:{" "}
          <Link
            className="font-medium text-emerald-900 underline-offset-2 hover:underline"
            href={`/registar/${Number.parseInt(registryId, 10)}/recenzija?building_id=${encodeURIComponent(buildingId)}`}
          >
            otvori formu →
          </Link>
        </p>
      ) : null}
      {msg ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700">{msg}</div>
      ) : null}
    </div>
  );
}
