import Link from "next/link";

export default function BuildingsPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Zgrade
          </h1>
          <Link
            href="/dashboard/moje-zgrade"
            className="text-sm font-medium text-zinc-900 underline underline-offset-4"
          >
            Moje zgrade →
          </Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          MVP: javni listing je ograničen; pristup detaljima zgrade imaju samo
          verifikovani članovi ili admin.
        </p>
      </main>
    </div>
  );
}

