import Link from "next/link";

/** Zaključan Premium modul zgrade (stranica se prikazuje, sadržaj ne). */
export default function PremiumLocked({ buildingId, title, desc }: { buildingId: string; title: string; desc: string }) {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">★</div>
          <h1 className="text-xl font-semibold text-zinc-900">{title} — Premium funkcija</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{desc}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={`/zgrade/${buildingId}/pretplata`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Kako se aktivira Premium
            </Link>
            <Link
              href={`/zgrade/${buildingId}`}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Nazad na zgradu
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
