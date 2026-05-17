import MapaClient from "./ui";

export default function MapSearchPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Pretraga upravnika — mapa
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pronađite upravnika u svom komšiluku. Kliknite na marker za detalje.
        </p>
      </div>
      <div className="flex flex-1 flex-col">
        <MapaClient mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ""} />
      </div>
    </div>
  );
}
