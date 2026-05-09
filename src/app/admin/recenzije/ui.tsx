"use client";

import { useState } from "react";

type ReviewRow = {
  id: string;
  manager_user_id: string;
  reviewer_user_id: string;
  rating_overall: number;
  title: string | null;
  content: string | null;
  status: string;
  created_at: string;
};

export default function AdminReviewsClient({ reviews }: { reviews: ReviewRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function setStatus(id: string, status: "published" | "hidden" | "removed") {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
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
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  {r.title ?? "Bez naslova"} • {r.rating_overall}/5
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  status: {r.status} • manager: {r.manager_user_id} • reviewer:{" "}
                  {r.reviewer_user_id} •{" "}
                  {new Date(r.created_at).toLocaleString("sr-RS")}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busyId === r.id}
                  onClick={() => setStatus(r.id, "published")}
                  className="h-9 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  Publish
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => setStatus(r.id, "hidden")}
                  className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  Hide
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => setStatus(r.id, "removed")}
                  className="h-9 rounded-lg bg-rose-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-3 text-sm text-zinc-700">{r.content ?? ""}</div>
          </div>
        ))}
        {!reviews.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema recenzija.
          </div>
        ) : null}
      </div>
    </div>
  );
}

