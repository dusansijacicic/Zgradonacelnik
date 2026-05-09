export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
      <main className="w-full max-w-3xl rounded-2xl border border-border-subtle bg-surface p-6 shadow-md sm:p-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium tracking-wide text-brand-sky">
            Zgradonačelnik.rs (MVP)
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">
            Transparentno upravljanje stambenim zajednicama
          </h1>
          <p className="text-base leading-7 text-brand-navy/80">
            Platforma za pretragu i recenzije profesionalnih upravnika, evidenciju
            zgrada i online dnevnik zgrade. Sledeće: Google login, profili
            upravnika i sistem recenzija.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a
            href="/pretraga"
            className="rounded-xl border border-brand-sky/40 bg-brand-sky-muted px-4 py-4 text-center text-sm font-medium text-brand-navy transition-colors hover:border-brand-sky hover:bg-brand-sky/15"
          >
            Pretraga upravnika →
          </a>
          <a
            href="/login"
            className="rounded-xl bg-brand-green px-4 py-4 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-green-hover"
          >
            Prijava (Google) →
          </a>
        </div>
      </main>
    </div>
  );
}
