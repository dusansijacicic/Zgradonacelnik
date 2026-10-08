/** Trenutni prikaz dok se stranica učitava (klik → odmah vidljiva promena, bez čekanja servera). */
export default function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10" aria-busy="true" aria-label="Učitavanje">
      <div className="w-full max-w-5xl animate-pulse space-y-4">
        <div className="h-4 w-28 rounded bg-zinc-200" />
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="h-6 w-2/5 rounded bg-zinc-200" />
          <div className="mt-3 h-4 w-3/5 rounded bg-zinc-100" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-zinc-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
