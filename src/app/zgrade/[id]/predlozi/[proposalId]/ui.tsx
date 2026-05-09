"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

type Row = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
};

export default function ProposalCommentsClient({
  proposalId,
  initial,
}: {
  proposalId: string;
  initial: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [content, setContent] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/proposal-comments/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal_id: proposalId, content, captcha_token: captchaToken }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setRows((prev) => [...prev, json.row]);
      setContent("");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <textarea
          className="h-24 w-full rounded-xl border border-zinc-200 p-3 text-sm"
          placeholder="Napiši komentar..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button
          disabled={busy || content.trim().length === 0}
          onClick={create}
          className="mt-3 h-10 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
        >
          Pošalji komentar
        </button>
        <div className="mt-3">
          <TurnstileWidget onToken={setCaptchaToken} />
        </div>
        {msg ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            {msg}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">
              {new Date(r.created_at).toLocaleString("sr-RS")} • {r.user_id}
            </div>
            <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
              {r.content}
            </div>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema komentara.
          </div>
        ) : null}
      </div>
    </div>
  );
}

