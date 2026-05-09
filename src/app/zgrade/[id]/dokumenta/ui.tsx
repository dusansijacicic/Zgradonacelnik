"use client";

import { useState } from "react";

type Row = {
  id: string;
  document_type: string;
  title: string | null;
  file_name: string | null;
  file_size: number | null;
  visibility: string;
  created_at: string;
};

export default function DocumentsClient({
  buildingId,
  initial,
}: {
  buildingId: string;
  initial: Row[];
}) {
  const [rows] = useState<Row[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function download(docId: string) {
    setBusyId(docId);
    setMsg(null);
    try {
      const res = await fetch(`/api/documents/signed-url?id=${encodeURIComponent(docId)}`);
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      {msg ? (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {msg}
        </div>
      ) : null}
      <div className="grid gap-3">
        {rows.map((d) => (
          <div key={d.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  {d.title ?? d.file_name ?? "Dokument"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {d.document_type} • {d.visibility} •{" "}
                  {new Date(d.created_at).toLocaleString("sr-RS")}
                </div>
              </div>
              <button
                disabled={busyId === d.id}
                onClick={() => download(d.id)}
                className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                Preuzmi
              </button>
            </div>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema dokumenata za ovu zgradu.
          </div>
        ) : null}
      </div>
    </div>
  );
}

