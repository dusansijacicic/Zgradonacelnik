"use client";

import { useState } from "react";

export default function ReportReviewClient({
  reviewId,
  managerId,
}: {
  reviewId: string;
  managerId: string;
}) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/review-reports/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          review_id: reviewId,
          reason,
          details,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setMsg("Prijava poslata.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  if (!reviewId) {
    return (
      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        Nedostaje `review_id` u URL-u. Vrati se na profil upravnika{" "}
        <a className="underline underline-offset-4" href={`/upravnik/${managerId}`}>
          ovde
        </a>
        .
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-3">
      <select
        className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      >
        <option value="spam">Spam</option>
        <option value="uvredljivo">Uvredljiv sadržaj</option>
        <option value="neistina">Neistinit sadržaj</option>
        <option value="privatnost">Otkriva privatne podatke</option>
        <option value="drugo">Drugo</option>
      </select>
      <textarea
        className="h-28 rounded-xl border border-zinc-200 p-3 text-sm"
        placeholder="Detalji (opciono)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />
      <button
        disabled={busy}
        onClick={submit}
        className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
      >
        Pošalji prijavu
      </button>
      {msg ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {msg}
        </div>
      ) : null}
    </div>
  );
}

