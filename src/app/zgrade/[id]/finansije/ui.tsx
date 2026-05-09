"use client";

import { useState } from "react";

type Tx = {
  id: string;
  transaction_type: string;
  category: string | null;
  amount: string;
  currency: string;
  transaction_date: string;
  description: string | null;
  status: string;
  created_at: string;
};

export default function FinanceClient({
  buildingId,
  initial,
}: {
  buildingId: string;
  initial: Tx[];
}) {
  const [rows, setRows] = useState<Tx[]>(initial);
  const [type, setType] = useState<"inflow" | "outflow">("outflow");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/transactions/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          building_id: buildingId,
          transaction_type: type,
          amount: Number(amount),
          category: category || null,
          transaction_date: date,
          description: description || null,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Greška");
      setRows((prev) => [json.row, ...prev]);
      setAmount("");
      setCategory("");
      setDescription("");
      setMsg("Transakcija dodata.");
    } catch (e: any) {
      setMsg(e?.message ?? "Greška");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-medium text-zinc-900">Nova transakcija</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            <option value="inflow">Priliv</option>
            <option value="outflow">Odliv</option>
          </select>
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Iznos (RSD)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-zinc-200 px-3 text-sm"
            placeholder="Kategorija"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <textarea
          className="mt-3 h-24 w-full rounded-xl border border-zinc-200 p-3 text-sm"
          placeholder="Opis"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          disabled={busy}
          onClick={create}
          className="mt-3 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
        >
          Sačuvaj
        </button>
        {msg ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            {msg}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {rows.map((t) => (
          <div key={t.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-900">
                {t.transaction_type} • {t.amount} {t.currency}
              </div>
              <div className="text-xs text-zinc-500">{t.transaction_date}</div>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {t.category ?? "—"} • {t.status}
            </div>
            {t.description ? (
              <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
                {t.description}
              </div>
            ) : null}
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nema transakcija.
          </div>
        ) : null}
      </div>
    </div>
  );
}

