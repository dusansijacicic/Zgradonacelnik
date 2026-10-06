"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { type PickedAddress } from "@/components/AddressAutocomplete";

export default function ManagerNewBuildingClient() {
  const router = useRouter();
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const [entrance, setEntrance] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return setError("Izaberi adresu iz liste.");
    if (!file) return setError("Priloži dokaz ovlašćenja.");
    if (!confirm) return setError("Potvrdi da imaš ovlašćenje za ovu zgradu.");
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("place_id", address.placeId);
      fd.append("session_token", address.sessionToken);
      if (entrance.trim()) fd.append("entrance", entrance.trim());
      fd.append("start_date", startDate);
      fd.append("proof", file);
      const res = await fetch("/api/manager/buildings", { method: "POST", body: fd });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Greška");
      router.push("/manager/zgrade?poslato=1");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Greška");
      setBusy(false);
    }
  }

  const inputCls = "h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm";

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <AddressAutocomplete value={address} onChange={setAddress} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-600">Ulaz (opciono)</label>
          <input value={entrance} onChange={(e) => setEntrance(e.target.value)} maxLength={10} placeholder="A, B, 1…" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-600">Upravljam od</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
          Dokaz ovlašćenja <span className="text-red-500">*</span> <span className="font-normal text-zinc-400">(PDF/JPG/PNG, do 15 MB — vidi ga samo admin)</span>
        </label>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </div>
      <label className="flex items-start gap-2.5 text-xs text-zinc-600">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          Potvrđujem da sam postavljen za upravnika ove stambene zajednice i da su podaci tačni. Upoznat sam sa{" "}
          <a href="/pravila" target="_blank" className="underline">pravilima za upravnike</a>.
        </span>
      </label>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <button disabled={busy} className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Šaljem..." : "Pošalji na odobrenje"}
      </button>
    </form>
  );
}
