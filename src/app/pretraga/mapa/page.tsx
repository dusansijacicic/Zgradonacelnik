import RadiusSearchClient from "./ui";

export default function MapSearchPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Radius pretraga (MVP)
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Ovo je minimalan UI bez mape. Koristi PostGIS RPC i vraća upravnike na
          osnovu aktivnih zgrada u radijusu.
        </p>

        <div className="mt-6">
          <RadiusSearchClient />
        </div>
      </main>
    </div>
  );
}

