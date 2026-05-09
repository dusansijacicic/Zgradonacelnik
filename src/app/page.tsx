export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <main className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium tracking-wide text-zinc-500">
            Zgradonačelnik.rs (MVP)
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Transparentno upravljanje stambenim zajednicama
          </h1>
          <p className="text-base leading-7 text-zinc-600">
            Platforma za pretragu i recenzije profesionalnih upravnika, evidenciju
            zgrada i online dnevnik zgrade. Sledeće: Google login, profili
            upravnika i sistem recenzija.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a
            href="/pretraga"
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Pretraga upravnika →
          </a>
          <a
            href="/login"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Prijava (Google) →
          </a>
        </div>
      </main>
    </div>
  );
}
