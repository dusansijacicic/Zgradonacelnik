"use client";

import { useState } from "react";

export default function AssignmentRequestClient({
  buildingId,
  canRequest,
}: {
  buildingId: string;
  canRequest: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      // 1) upload proof document
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", "Dokaz ovlašćenja (upravnik)");
      const up = await fetch(
        `/api/documents/upload?building_id=${encodeURIComponent(
          buildingId,
        )}&document_type=contract&visibility=private`,
        { method: "POST", body: fd },
      );
      const upJson = (await up.json()) as any;
      if (!up.ok) throw new Error(upJson?.error ?? "Upload greška");

      // 2) request assignment
      const req = await fetch("/api/assignments/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          building_id: buildingId,
          proof_document_id: upJson.id,
          start_date: startDate,
        }),
      });
      const reqJson = (await req.json()) as any;
      if (!req.ok) throw new Error(reqJson?.error ?? "Greška");
      setMsg("Zahtev poslat (pending). Admin treba da odobri.");
      setFile(null);
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  if (!canRequest) {
    return (
      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        Ako si verifikovan profesionalni upravnik, ovde možeš da pošalješ zahtev
        da preuzmeš ovu zgradu (uz dokaz).
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-medium text-zinc-900">
        Zahtev: postavi se kao upravnik zgrade
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Uploaduj dokaz (ugovor/odluka) i pošalji zahtev adminu.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="date"
          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <input
          type="file"
          className="h-11 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <button
        disabled={busy || !file}
        onClick={submit}
        className="mt-3 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
      >
        Pošalji zahtev
      </button>

      {msg ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {msg}
        </div>
      ) : null}
    </div>
  );
}

