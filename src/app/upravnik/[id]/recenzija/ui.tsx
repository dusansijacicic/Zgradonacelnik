"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function ReviewClient({ managerId }: { managerId: string }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reviews/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manager_user_id: managerId,
          rating_overall: rating,
          title,
          content,
          captcha_token: captchaToken,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setMsg("Recenzija poslata (status: pending).");
      setTitle("");
      setContent("");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-3">
      <label className="text-sm font-medium text-zinc-900">Ocena (1-5)</label>
      <input
        type="number"
        min={1}
        max={5}
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
      />
      <input
        placeholder="Naslov"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
      />
      <textarea
        placeholder="Tekst recenzije"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="h-40 rounded-xl border border-zinc-200 p-3 text-sm"
      />
      <button
        disabled={busy}
        onClick={submit}
        className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
      >
        Pošalji recenziju
      </button>

      <TurnstileWidget onToken={setCaptchaToken} />
      {msg ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {msg}
        </div>
      ) : null}
    </div>
  );
}

