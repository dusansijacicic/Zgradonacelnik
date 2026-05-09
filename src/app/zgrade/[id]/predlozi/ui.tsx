"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

type Row = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  estimated_cost: number | null;
  created_at: string;
};

export default function ProposalsClient({
  buildingId,
  initial,
}: {
  buildingId: string;
  initial: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<
    "repair" | "cleaning" | "security" | "maintenance" | "finance" | "other"
  >("repair");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">(
    "medium",
  );
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/proposals/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          building_id: buildingId,
          title,
          description,
          category,
          priority,
          captcha_token: captchaToken,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setRows((prev) => [json.row, ...prev]);
      setTitle("");
      setDescription("");
      setMsg("Predlog dodat.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-medium text-zinc-900">Novi predlog</div>
        <div className="mt-3 grid gap-3">
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Naslov"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="h-32 rounded-xl border border-zinc-200 p-3 text-sm"
            placeholder="Opis"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
            >
              <option value="repair">Popravka</option>
              <option value="cleaning">Čišćenje</option>
              <option value="security">Bezbednost</option>
              <option value="maintenance">Održavanje</option>
              <option value="finance">Finansije</option>
              <option value="other">Ostalo</option>
            </select>
            <select
              className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
            >
              <option value="low">Nisko</option>
              <option value="medium">Srednje</option>
              <option value="high">Visoko</option>
              <option value="urgent">Hitno</option>
            </select>
          </div>
          <button
            disabled={busy}
            onClick={create}
            className="h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
          >
            Pošalji predlog
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                className="text-sm font-medium text-zinc-900 underline underline-offset-4"
                href={`/zgrade/${buildingId}/predlozi/${r.id}`}
              >
                {r.title}
              </a>
              <div className="text-xs text-zinc-500">
                {r.category} • {r.priority} • {r.status} •{" "}
                {new Date(r.created_at).toLocaleString("sr-RS")}
              </div>
            </div>
            <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
              {r.description}
            </div>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema predloga.
          </div>
        ) : null}
      </div>
    </div>
  );
}

