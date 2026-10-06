"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Order = {
  id: string;
  reference: string;
  amount: number;
  months: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  orderedBy: string;
  addresses: string[];
};
type Sub = { buildingId: string; status: string; periodEnd: string | null; address: string; manager: string };

export default function AdminPretplateClient({ orders, subscriptions }: { orders: Order[]; subscriptions: Sub[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function act(key: string, payload: Record<string, string>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(key);
    setMsg(null);
    const res = await fetch("/api/admin/building-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    setBusy(null);
    if (!res.ok) setMsg(json.detail ?? json.error ?? "Greška");
    else router.refresh();
  }

  const q = filter.replace(/\D/g, "");
  const pending = orders.filter((o) => o.status === "pending_payment" && (!q || o.reference.includes(q)));
  const done = orders.filter((o) => o.status !== "pending_payment");

  return (
    <div className="mt-6 space-y-8">
      {msg ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div> : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-800">Čekaju uplatu ({pending.length})</h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Traži poziv na broj…"
            className="h-9 rounded-lg border border-zinc-200 px-3 text-sm"
          />
        </div>
        <div className="space-y-2">
          {pending.map((o) => (
            <div key={o.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold text-zinc-900">97 · {o.reference}</div>
                  <div className="mt-0.5 text-sm text-zinc-800">
                    {o.amount.toLocaleString("sr-RS")} RSD · {o.months} mes. · {o.orderedBy}
                  </div>
                  <ul className="mt-1 list-disc pl-5 text-xs text-zinc-600">
                    {o.addresses.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                  <div className="mt-1 text-xs text-zinc-400">{new Date(o.createdAt).toLocaleString("sr-RS")}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busy === o.id}
                    onClick={() =>
                      act(o.id, { action: "activate_order", order_id: o.id }, `Potvrditi uplatu ${o.amount} RSD (${o.reference})?`)
                    }
                    className="h-9 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Uplata stigla — aktiviraj
                  </button>
                  <button
                    disabled={busy === o.id}
                    onClick={() => act(o.id, { action: "cancel_order", order_id: o.id }, "Otkazati porudžbinu?")}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 disabled:opacity-50"
                  >
                    Otkaži
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!pending.length ? <div className="text-sm text-zinc-500">Nema porudžbina koje čekaju uplatu.</div> : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-800">Premium zgrade ({subscriptions.length})</h2>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm">
          {subscriptions.map((s) => {
            const expired = s.status !== "active" || (s.periodEnd && new Date(s.periodEnd) < new Date());
            return (
              <div key={s.buildingId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-zinc-800">{s.address}</span>
                <span className="text-xs text-zinc-500">{s.manager}</span>
                <span className={`text-xs font-semibold ${expired ? "text-red-600" : "text-emerald-700"}`}>
                  {expired ? "Isteklo" : "Do"} {s.periodEnd ? new Date(s.periodEnd).toLocaleDateString("sr-RS") : "—"}
                </span>
                {!expired ? (
                  <button
                    disabled={busy === s.buildingId}
                    onClick={() => act(s.buildingId, { action: "deactivate", building_id: s.buildingId }, "Ugasiti Premium ovoj zgradi?")}
                    className="text-xs text-red-600 underline"
                  >
                    Ugasi
                  </button>
                ) : null}
              </div>
            );
          })}
          {!subscriptions.length ? <div className="px-4 py-3 text-zinc-500">Još nema Premium zgrada.</div> : null}
        </div>
      </section>

      {done.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-800">Istorija porudžbina</h2>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-xs">
            {done.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <span className="font-mono">{o.reference}</span>
                <span className="flex-1 truncate text-zinc-600">{o.addresses.join("; ")}</span>
                <span>{o.amount} RSD</span>
                <span className={o.status === "paid" ? "text-emerald-700" : "text-zinc-400"}>
                  {o.status === "paid" ? `Plaćeno ${o.paidAt ? new Date(o.paidAt).toLocaleDateString("sr-RS") : ""}` : "Otkazano"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
