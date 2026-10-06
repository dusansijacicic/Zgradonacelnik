"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type MemberRow = {
  id: string;
  name: string;
  address?: string;
  role: string;
  apartment: string | null;
  status: string;
  hasProof: boolean;
  note: string | null;
  proofUploadedAt: string | null;
};

const ROLE: Record<string, string> = { resident: "Član domaćinstva", owner: "Vlasnik", tenant: "Zakupac", board_member: "Član saveta" };
const STATUS: Record<string, string> = { verified: "Potvrđen", pending: "Dokaz poslat", unverified: "Bez dokaza", rejected: "Odbijen" };

export default function MembershipReviewList({ rows }: { rows: MemberRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openProof(id: string) {
    const res = await fetch(`/api/memberships/review?id=${encodeURIComponent(id)}`);
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
    else setError(json.error ?? "Dokaz nije dostupan");
  }

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/memberships/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    setBusy(null);
    if (!res.ok) setError(json.detail ?? json.error ?? "Greška");
    else router.refresh();
  }

  if (!rows.length) return <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">Nema članova za prikaz.</div>;

  return (
    <div className="space-y-2">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-900">
              {r.name}
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {ROLE[r.role] ?? r.role}
                {r.apartment ? ` · stan ${r.apartment}` : ""}
              </span>
            </div>
            {r.address ? <div className="truncate text-xs text-zinc-500">{r.address}</div> : null}
            {r.note ? <div className="text-xs italic text-zinc-500">„{r.note}“</div> : null}
          </div>
          <span className="text-xs text-zinc-500">{STATUS[r.status] ?? r.status}</span>
          {r.hasProof ? (
            <button onClick={() => openProof(r.id)} className="text-xs font-semibold text-sky-700 underline">
              Dokaz
            </button>
          ) : null}
          {r.status !== "verified" ? (
            <button
              disabled={busy === r.id}
              onClick={() => act(r.id, "approve")}
              className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Potvrdi
            </button>
          ) : null}
          {r.status !== "rejected" ? (
            <button
              disabled={busy === r.id}
              onClick={() => act(r.id, "reject")}
              className="h-8 rounded-lg border border-zinc-200 px-3 text-xs text-zinc-700 disabled:opacity-50"
            >
              {r.status === "verified" ? "Ukloni potvrdu" : "Odbij"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
