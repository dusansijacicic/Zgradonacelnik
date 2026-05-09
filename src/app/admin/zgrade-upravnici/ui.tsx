"use client";

import { useState } from "react";

type Row = {
  id: string;
  building_id: string;
  manager_user_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  proof_document_id: string | null;
  created_at: string;
};

export default function AdminAssignmentsClient({ rows }: { rows: Row[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject" | "end") {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setMsg("Sačuvano. Osveži stranicu.");
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
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  {r.status} • building: {r.building_id}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  manager: {r.manager_user_id} • proof: {r.proof_document_id ?? "—"} •{" "}
                  {new Date(r.created_at).toLocaleString("sr-RS")}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busyId === r.id}
                  onClick={() => act(r.id, "approve")}
                  className="h-9 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => act(r.id, "reject")}
                  className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => act(r.id, "end")}
                  className="h-9 rounded-lg bg-amber-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  End
                </button>
              </div>
            </div>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema zahteva.
          </div>
        ) : null}
      </div>
    </div>
  );
}

