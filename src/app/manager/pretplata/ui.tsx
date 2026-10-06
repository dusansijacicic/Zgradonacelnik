"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PaymentSlip from "@/components/PaymentSlip";

type Building = { id: string; address: string; active: boolean; periodEnd: string | null; pending: boolean };
type Order = {
  id: string;
  payment_reference: string;
  amount_rsd: number;
  months: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  addresses: string[];
};

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Čeka uplatu", cls: "bg-amber-100 text-amber-800" },
  paid: { label: "Plaćeno", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Otkazano", cls: "bg-zinc-100 text-zinc-500" },
};

export default function ManagerSubscriptionClient({
  buildings,
  billingOptions,
  pricePerMonth,
  payment,
  orders,
}: {
  buildings: Building[];
  billingOptions: { months: number; label: string; paidMonths: number }[];
  pricePerMonth: number;
  payment: { accountNumber: string; recipient: string; model: string };
  orders: Order[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(buildings.filter((b) => !b.active).map((b) => b.id)));
  const [months, setMonths] = useState(billingOptions[0]?.months ?? 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidMonths = billingOptions.find((o) => o.months === months)?.paidMonths ?? months;
  const total = selected.size * pricePerMonth * paidMonths;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function order() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ building_ids: Array.from(selected), months }),
      });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Greška");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!confirm("Otkazati ovu porudžbinu?")) return;
    await fetch(`/api/subscriptions/order?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  const pendingOrders = orders.filter((o) => o.status === "pending_payment");

  return (
    <div className="mt-6 space-y-6">
      {pendingOrders.map((o) => (
        <div key={o.id} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-zinc-800">
              Porudžbina za {o.addresses.length} {o.addresses.length === 1 ? "zgradu" : "zgrade"} · {o.months} mes.
            </span>
            <button onClick={() => cancel(o.id)} className="text-xs text-zinc-500 underline">
              Otkaži
            </button>
          </div>
          <PaymentSlip
            data={{
              recipient: payment.recipient,
              accountNumber: payment.accountNumber,
              model: payment.model,
              reference: o.payment_reference,
              amountRsd: o.amount_rsd,
              purpose: `Premium Zgradonačelnik ${o.months} mes.`,
            }}
          />
        </div>
      ))}

      {buildings.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          Još nemaš aktivnih zgrada. Premium se plaća za zgrade u kojima si odobren kao upravnik.{" "}
          <Link href="/manager/zgrade/nova" className="font-semibold underline">
            Dodaj zgradu →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200">
          {buildings.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0">
              <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4" />
              <span className="flex-1 text-sm text-zinc-800">{b.address}</span>
              {b.active ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  Aktivno do {b.periodEnd ? new Date(b.periodEnd).toLocaleDateString("sr-RS") : "—"}
                </span>
              ) : b.pending ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Čeka uplatu</span>
              ) : (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">Bez Premium-a</span>
              )}
            </label>
          ))}
        </div>
      )}

      {buildings.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">Period</label>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            >
              {billingOptions.map((o) => (
                <option key={o.months} value={o.months}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 text-right text-sm text-zinc-600">
            Ukupno: <span className="text-lg font-bold text-zinc-900">{total.toLocaleString("sr-RS")} RSD</span>
            <div className="text-xs text-zinc-400">Aktivnim zgradama se period produžava.</div>
          </div>
          <button
            disabled={busy || selected.size === 0}
            onClick={order}
            className="h-11 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "..." : "Poruči i prikaži uplatnicu"}
          </button>
        </div>
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {orders.filter((o) => o.status !== "pending_payment").length ? (
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-800">Istorija porudžbina</div>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm">
            {orders
              .filter((o) => o.status !== "pending_payment")
              .map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="font-mono text-xs text-zinc-500">{o.payment_reference}</span>
                  <span className="flex-1 truncate text-zinc-700">{o.addresses.join("; ")}</span>
                  <span className="text-zinc-700">{o.amount_rsd} RSD</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ORDER_STATUS[o.status]?.cls ?? ""}`}>
                    {ORDER_STATUS[o.status]?.label ?? o.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
