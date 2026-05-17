"use client";

import { useState } from "react";
import type { BuildingSubscription } from "@/lib/buildingPremium";

type Props = {
  buildingId: string;
  address: string;
  isManager: boolean;
  subscription: BuildingSubscription | null;
  paymentAccountNumber: string;
  paymentModel: string;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktivan",
  pending_payment: "Čeka uplatu",
  expired: "Istekao",
  cancelled: "Otkazan",
  inactive: "Neaktivan",
};

export default function PretplataClient({
  buildingId,
  address,
  isManager,
  subscription,
  paymentAccountNumber,
  paymentModel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(subscription?.payment_reference ?? null);
  const [error, setError] = useState<string | null>(null);

  async function requestPremium() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/buildings/request-premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building_id: buildingId }),
      });
      const json = (await res.json()) as { payment_reference?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Greška");
      setRef(json.payment_reference ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  const isActive = subscription?.status === "active";
  const isPending = subscription?.status === "pending_payment" || ref;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              Premium pretplata
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{address}</p>
          </div>
          {subscription?.status && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isActive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {STATUS_LABELS[subscription.status] ?? subscription.status}
            </span>
          )}
        </div>

        {isActive && (
          <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-sm font-medium text-emerald-800">
              Premium aktivan
              {subscription?.current_period_end
                ? ` do ${new Date(subscription.current_period_end).toLocaleDateString("sr-RS")}`
                : ""}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Sve Premium funkcije su dostupne: finansije, dokumenta, zapisnici sastanaka.
            </p>
          </div>
        )}

        {!isActive && !isPending && (
          <>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">
                  Premium plan — <span className="line-through text-zinc-400">1.000 RSD/mes.</span>{" "}
                  <span className="text-emerald-700">500 RSD/mes.</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
                  <li>✓ Finansijsko praćenje (prihodi i rashodi sa dokazima)</li>
                  <li>✓ Zapisnici sa sastanaka stanara</li>
                  <li>✓ Premium dokumenta i arhiva</li>
                  <li>✓ Premium značka na profilu upravnika</li>
                </ul>
              </div>
            </div>

            {isManager && (
              <button
                disabled={busy}
                onClick={requestPremium}
                className="mt-5 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
              >
                {busy ? "Generiše se referenca..." : "Zatraži Premium — 500 RSD/mes."}
              </button>
            )}

            {!isManager && (
              <p className="mt-4 text-sm text-zinc-500">
                Premium može da zatraži samo aktivni upravnik ove zgrade.
              </p>
            )}

            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </>
        )}

        {isPending && !isActive && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">
              Zahtev primljen — pošaljite uplatu
            </p>
            <div className="space-y-2 text-sm text-amber-800">
              <div className="flex justify-between">
                <span className="text-amber-700">Iznos:</span>
                <span className="font-medium">500,00 RSD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Primalac:</span>
                <span className="font-medium">Zgradonačelnik</span>
              </div>
              {paymentAccountNumber && (
                <div className="flex justify-between">
                  <span className="text-amber-700">Račun:</span>
                  <span className="font-mono font-medium">{paymentAccountNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-amber-700">Model:</span>
                <span className="font-mono font-medium">{paymentModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Poziv na broj:</span>
                <span className="font-mono font-bold text-zinc-900">{ref ?? subscription?.payment_reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Svrha:</span>
                <span className="font-medium">Premium pretplata Zgradonacaelnik.rs</span>
              </div>
            </div>
            <p className="text-xs text-amber-700 pt-1 border-t border-amber-200">
              Nakon što uplata bude verifikovana, admin će aktivirati Premium za ovu zgradu (obično
              unutar 1 radnog dana).
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        <p className="font-medium text-zinc-900">Pitanja?</p>
        <p className="mt-1">
          Pišite nam na{" "}
          <a href="/kontakt" className="text-zinc-900 underline underline-offset-2">
            kontakt stranici
          </a>{" "}
          ili na email.
        </p>
      </div>
    </div>
  );
}
