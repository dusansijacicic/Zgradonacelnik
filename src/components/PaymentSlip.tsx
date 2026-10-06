"use client";

import { useState } from "react";

export type PaymentSlipData = {
  recipient: string;
  accountNumber: string;
  model: string;
  reference: string;
  amountRsd: number;
  purpose: string;
};

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-100 py-2 last:border-0">
      <span className="text-xs text-amber-800">{label}</span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className={`text-right text-sm font-semibold text-amber-950 hover:underline ${mono ? "font-mono" : ""}`}
        title="Kopiraj"
      >
        {value || "—"} <span className="text-[10px] font-normal text-amber-600">{copied ? "✓" : "⧉"}</span>
      </button>
    </div>
  );
}

/** Podaci za uplatnicu / e-banking (nalog za prenos). */
export default function PaymentSlip({ data }: { data: PaymentSlipData }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Nalog za prenos</div>
      <Row label="Primalac" value={data.recipient} />
      <Row label="Račun primaoca" value={data.accountNumber} mono />
      <Row label="Iznos" value={`${data.amountRsd.toLocaleString("sr-RS")},00 RSD`} mono />
      <Row label="Šifra plaćanja (firma / fizičko lice)" value="221 / 289" mono />
      <Row label="Model" value={data.model} mono />
      <Row label="Poziv na broj" value={data.reference} mono />
      <Row label="Svrha uplate" value={data.purpose} />
      <p className="mt-3 text-xs text-amber-800">
        Obavezno upiši tačan model i poziv na broj — po njemu automatski prepoznajemo uplatu. Aktivacija je obično u
        roku od 1 radnog dana.
      </p>
    </div>
  );
}
