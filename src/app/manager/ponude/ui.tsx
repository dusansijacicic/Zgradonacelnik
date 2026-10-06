"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Building = { id: string; address: string; municipality: string | null; members: number; offers: number; alreadyOffered: boolean };

export function OfferForm({ buildingId, onDone }: { buildingId: string; onDone?: () => void }) {
  const router = useRouter();
  const [message, setMessage] = useState(
    "Poštovani, profesionalni sam upravnik sa licencom PKS. Nudim transparentno upravljanje vašom zgradom: redovni izveštaji o finansijama na platformi, brz odziv na kvarove i redovne skupštine.",
  );
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        building_id: buildingId,
        message,
        price_monthly_rsd: price ? Number(price) : null,
        contact_phone: phone || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    setBusy(false);
    if (!res.ok) return setError(json.detail ?? json.error ?? "Greška");
    onDone?.();
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={2000}
        className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
          placeholder="Cena mesečno za zgradu (RSD, opciono)"
          className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefon za kontakt (opciono)"
          className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
        />
      </div>
      <p className="text-[11px] text-zinc-500">Stanari vide tvoje ime, ocene, poruku, cenu i kontakt koji ovde ostaviš (i email naloga).</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button disabled={busy} onClick={send} className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "..." : "Pošalji ponudu"}
      </button>
    </div>
  );
}

export default function OffersClient({ buildings }: { buildings: Building[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!buildings.length) {
    return <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">Nema zgrada za ovu pretragu.</div>;
  }

  return (
    <div className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
      {buildings.map((b) => (
        <div key={b.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-900">{b.address}</div>
              <div className="text-xs text-zinc-500">
                {b.municipality ? `${b.municipality} · ` : ""}
                {b.members} {b.members === 1 ? "registrovan stanar" : "registrovanih stanara"} · {b.offers} ponuda
              </div>
            </div>
            {b.alreadyOffered ? (
              <span className="text-xs font-semibold text-emerald-700">✓ Ponuda poslata</span>
            ) : (
              <button
                onClick={() => setOpenId(openId === b.id ? null : b.id)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800"
              >
                {openId === b.id ? "Zatvori" : "Ponudi upravljanje"}
              </button>
            )}
          </div>
          {openId === b.id ? <OfferForm buildingId={b.id} onDone={() => setOpenId(null)} /> : null}
        </div>
      ))}
    </div>
  );
}
