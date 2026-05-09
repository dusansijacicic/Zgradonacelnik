"use client";

import { useState } from "react";

type ReqRow = {
  id: string;
  user_id: string;
  requested_email: string | null;
  requested_phone: string | null;
  status: string;
  created_at: string;
};

export default function AdminVerificationClient({ requests }: { requests: ReqRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/manager-verifications", {
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
        {requests.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  {r.requested_email ?? r.requested_phone ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  user_id: {r.user_id} • status: {r.status} •{" "}
                  {new Date(r.created_at).toLocaleString("sr-RS")}
                </div>
              </div>

              <div className="flex gap-2">
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
              </div>
            </div>
          </div>
        ))}

        {!requests.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema zahteva.
          </div>
        ) : null}
      </div>
    </div>
  );
}

