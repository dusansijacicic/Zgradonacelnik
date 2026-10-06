"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  buildingId: string;
  address: string;
  manager: string;
  source: string;
  requestedBy: string | null;
  status: string;
  startDate: string | null;
  proofDocumentId: string | null;
  createdAt: string;
};

const SOURCE: Record<string, string> = { manager: "upravnik sam", resident: "predlog stanara", admin: "admin", offer: "ponuda" };

export default function AdminAssignmentsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject" | "end") {
    setBusyId(id);
    setMsg(null);
    const res = await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusyId(null);
    if (!res.ok) setMsg(json.error ?? "Greška");
    else router.refresh();
  }

  async function openProof(docId: string) {
    const res = await fetch(`/api/documents/signed-url?id=${encodeURIComponent(docId)}`);
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
    else setMsg(json.error ?? "Dokaz nije dostupan");
  }

  return (
    <div className="mt-6 space-y-3">
      {msg ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div> : null}
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/zgrade/${r.buildingId}`} className="text-sm font-semibold text-zinc-900 hover:underline">
                {r.address}
              </Link>
              <div className="mt-0.5 text-sm text-zinc-700">{r.manager}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {SOURCE[r.source] ?? r.source}
                {r.requestedBy && r.source === "resident" ? ` (${r.requestedBy})` : ""} · od {r.startDate ?? "—"} ·{" "}
                {new Date(r.createdAt).toLocaleString("sr-RS")}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.proofDocumentId ? (
                <button onClick={() => openProof(r.proofDocumentId!)} className="h-9 rounded-lg border border-zinc-200 px-3 text-sm">
                  Dokaz
                </button>
              ) : null}
              {r.status === "pending" ? (
                <>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "approve")}
                    className="h-9 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Odobri
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "reject")}
                    className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Odbij
                  </button>
                </>
              ) : null}
              {r.status === "active" ? (
                <button
                  disabled={busyId === r.id}
                  onClick={() => confirm("Završiti mandat (upravnik postaje bivši)?") && act(r.id, "end")}
                  className="h-9 rounded-lg bg-amber-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  Završi mandat
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {!rows.length ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">Nema stavki.</div> : null}
    </div>
  );
}
