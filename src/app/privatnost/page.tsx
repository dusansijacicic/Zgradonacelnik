export default function PrivacyPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Politika privatnosti
        </h1>
        <div className="prose prose-zinc mt-6 max-w-none">
          <p>
            MVP verzija. Ne čuvamo nepotrebne lične podatke i ne prikazujemo javno email/telefon bez
            potrebe. Dokumenta se čuvaju privatno (Storage) i pristup se kontroliše RLS pravilima i
            signed URL pristupom (kada se uključi).
          </p>
          <p>
            Korisnički unosi se tretiraju kao nepoverljivi. Admin može moderirati sadržaj i
            deaktivirati naloge koji krše pravila.
          </p>
        </div>
      </main>
    </div>
  );
}

