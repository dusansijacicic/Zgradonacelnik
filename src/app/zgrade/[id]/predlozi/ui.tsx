"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

type VoteCounts = { for: number; against: number; abstain: number };

type Row = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  estimated_cost: number | null;
  created_at: string;
  vote_counts: VoteCounts;
  my_vote: "for" | "against" | "abstain" | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  repair: "Popravka", cleaning: "Čišćenje", security: "Bezbednost",
  maintenance: "Održavanje", finance: "Finansije", other: "Ostalo",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Nisko", medium: "Srednje", high: "Visoko", urgent: "Hitno",
};
const STATUS_LABELS: Record<string, string> = {
  proposed: "Predloženo", under_review: "U razmatranju",
  accepted: "Prihvaćeno", rejected: "Odbijeno", completed: "Završeno",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-600", medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700", urgent: "bg-red-100 text-red-700",
};

export default function ProposalsClient({
  buildingId,
  initial,
  canCreate,
  isManager,
}: {
  buildingId: string;
  initial: Row[];
  canCreate: boolean;
  isManager: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"repair" | "cleaning" | "security" | "maintenance" | "finance" | "other">("repair");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voteBusy, setVoteBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setMsg("Naslov je obavezan."); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/proposals/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ building_id: buildingId, title, description, category, priority, captcha_token: captchaToken }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      const newRow: Row = { ...json.row, vote_counts: { for: 0, against: 0, abstain: 0 }, my_vote: null };
      setRows((prev) => [newRow, ...prev]);
      setTitle(""); setDescription(""); setShowForm(false);
      setMsg("Predlog dodat.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  async function castVote(proposalId: string, vote: "for" | "against" | "abstain") {
    setVoteBusy(proposalId);
    try {
      const currentVote = rows.find((r) => r.id === proposalId)?.my_vote;
      const isUnvote = currentVote === vote;

      if (isUnvote) {
        await fetch("/api/proposal-votes/upsert", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposal_id: proposalId }),
        });
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== proposalId) return r;
            const counts = { ...r.vote_counts };
            counts[vote] = Math.max(0, counts[vote] - 1);
            return { ...r, vote_counts: counts, my_vote: null };
          }),
        );
      } else {
        const res = await fetch("/api/proposal-votes/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposal_id: proposalId, vote }),
        });
        const json = (await res.json()) as { counts?: VoteCounts };
        if (json.counts) {
          setRows((prev) =>
            prev.map((r) =>
              r.id === proposalId ? { ...r, vote_counts: json.counts!, my_vote: vote } : r,
            ),
          );
        }
      }
    } finally {
      setVoteBusy(null);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {canCreate && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              + Novi predlog
            </button>
          ) : (
            <form onSubmit={create} className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-3">
              <div className="text-sm font-medium text-zinc-900">Novi predlog rada</div>
              <input
                required
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                placeholder="Naslov predloga *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="h-28 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm"
                placeholder="Opis (opciono)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                >
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <TurnstileWidget onToken={setCaptchaToken} />
              {msg && <p className="text-xs text-red-600">{msg}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="h-9 rounded-lg bg-zinc-900 px-4 text-xs font-medium text-white disabled:opacity-60">
                  {busy ? "Šalje se..." : "Pošalji"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setMsg(null); }} className="h-9 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                  Otkaži
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!canCreate && !isManager && (
        <p className="text-sm text-zinc-500">Verifikovani stanari mogu predlagati radove i glasati.</p>
      )}

      {msg && !showForm && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{msg}</div>
      )}

      {rows.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          Nema predloga. {canCreate ? "Kliknite '+ Novi predlog' da dodate prvi." : ""}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <a
                  href={`/zgrade/${buildingId}/predlozi/${r.id}`}
                  className="text-sm font-semibold text-zinc-900 hover:underline"
                >
                  {r.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_COLOR[r.priority] ?? "bg-zinc-100 text-zinc-600"}`}>
                    {PRIORITY_LABELS[r.priority] ?? r.priority}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  {r.estimated_cost != null && (
                    <span className="text-xs text-zinc-500">
                      ~{r.estimated_cost.toLocaleString("sr-RS")} RSD
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-zinc-400 shrink-0">
                {new Date(r.created_at).toLocaleDateString("sr-RS")}
              </span>
            </div>

            {r.description && (
              <p className="mt-2 text-sm text-zinc-600 line-clamp-2">{r.description}</p>
            )}

            {/* Glasanje */}
            {canCreate && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-400">Glasajte:</span>
                {(["for", "against", "abstain"] as const).map((v) => {
                  const labels = { for: "Za", against: "Protiv", abstain: "Uzdržan" };
                  const colors = {
                    for: r.my_vote === v ? "bg-emerald-600 text-white" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                    against: r.my_vote === v ? "bg-red-600 text-white" : "border-red-200 text-red-700 hover:bg-red-50",
                    abstain: r.my_vote === v ? "bg-zinc-600 text-white" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
                  };
                  return (
                    <button
                      key={v}
                      disabled={voteBusy === r.id}
                      onClick={() => castVote(r.id, v)}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${colors[v]}`}
                    >
                      {labels[v]} {r.vote_counts[v] > 0 ? `(${r.vote_counts[v]})` : ""}
                    </button>
                  );
                })}
                {(r.vote_counts.for + r.vote_counts.against + r.vote_counts.abstain) > 0 && (
                  <span className="text-xs text-zinc-400">
                    Ukupno: {r.vote_counts.for + r.vote_counts.against + r.vote_counts.abstain} glasova
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
