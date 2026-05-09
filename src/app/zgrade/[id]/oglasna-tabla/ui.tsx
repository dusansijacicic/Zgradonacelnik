"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

type Row = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  visibility: string;
  created_at: string;
};

export default function AnnouncementClient({
  buildingId,
  initial,
}: {
  buildingId: string;
  initial: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/announcements/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          building_id: buildingId,
          title,
          content,
          visibility: "residents_only",
          pinned: false,
          captcha_token: captchaToken,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setRows((prev) => [json.row, ...prev]);
      setTitle("");
      setContent("");
      setMsg("Objava dodata.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-medium text-zinc-900">Nova objava</div>
        <div className="mt-3 grid gap-3">
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Naslov"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="h-32 rounded-xl border border-zinc-200 p-3 text-sm"
            placeholder="Sadržaj"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            disabled={busy}
            onClick={create}
            className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
          >
            Objavi
          </button>
          <TurnstileWidget onToken={setCaptchaToken} />
          {msg ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              {msg}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-900">{r.title}</div>
              <div className="text-xs text-zinc-500">
                {new Date(r.created_at).toLocaleString("sr-RS")}
              </div>
            </div>
            <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
              {r.content}
            </div>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema objava.
          </div>
        ) : null}
      </div>
    </div>
  );
}

