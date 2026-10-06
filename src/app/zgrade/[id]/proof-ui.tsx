"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProofUploadClient({ buildingId, status }: { buildingId: string; status: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("building_id", buildingId);
    fd.append("file", file);
    if (note.trim()) fd.append("note", note.trim());
    const res = await fetch("/api/memberships/upload-proof", { method: "POST", body: fd });
    const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ text: json.detail ?? json.error ?? "Greška", ok: false });
    setMsg({ text: "Dokaz je poslat. Obavestićemo te emailom kad bude potvrđen.", ok: true });
    router.refresh();
  }

  if (status === "pending") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <div className="font-semibold">Dokaz stanovanja je na proveri</div>
        <p className="mt-1">Potvrđuje ga upravnik zgrade ili administrator. Dok čekaš, možeš da čitaš oglasnu tablu.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <div className="font-bold text-blue-900">{status === "rejected" ? "Dokaz nije prihvaćen — pošalji novi" : "Potvrdi da stanuješ ovde"}</div>
      <p className="mt-1 text-sm text-blue-800">
        Ugovor o kupoprodaji/zakupu, list nepokretnosti ili račun (Infostan, EPS) na tvoje ime za ovu adresu. Lične
        podatke koji nisu potrebni možeš zatamniti. Dokaz vidi samo upravnik zgrade i administrator.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-blue-900"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Napomena (npr. stan 12)"
          className="h-10 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm"
        />
        <button disabled={busy || !file} onClick={submit} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Šaljem..." : "Pošalji dokaz"}
        </button>
      </div>
      {msg ? <div className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</div> : null}
    </div>
  );
}
