export default function TermsPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Uslovi korišćenja
        </h1>
        <div className="prose prose-zinc mt-6 max-w-none">
          <p>
            MVP verzija. Korišćenjem platforme prihvataš da unosiš tačne podatke, da ne zloupotrebljavaš
            sistem i da poštuješ pravila privatnosti i moderacije.
          </p>
          <p>
            Platforma je alat za transparentnost i evidenciju; ne predstavlja pravni savet niti sudski organ.
          </p>
        </div>
      </main>
    </div>
  );
}

