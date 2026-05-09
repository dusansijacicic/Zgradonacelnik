"use client";

import { useState } from "react";

export default function ManagerReviewReplyClient({
  reviewId,
  existing,
}: {
  reviewId: string;
  existing: string;
}) {
  const [content, setContent] = useState(existing);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/review-replies/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ review_id: reviewId, content }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setMsg("Odgovor sačuvan.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-medium text-zinc-700">Tvoj odgovor</div>
      <textarea
        className="mt-2 h-24 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm"
        placeholder="Odgovori na recenziju..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        disabled={busy || content.trim().length === 0}
        onClick={save}
        className="mt-2 h-9 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
      >
        Sačuvaj odgovor
      </button>
      {msg ? (
        <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-2 text-sm text-zinc-700">
          {msg}
        </div>
      ) : null}
    </div>
  );
}

