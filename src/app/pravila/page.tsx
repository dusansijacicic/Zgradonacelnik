export default function RulesPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Pravila
        </h1>
        <div className="prose prose-zinc mt-6 max-w-none">
          <h2>Pravila za upravnike</h2>
          <ul>
            <li>
              Upravnik garantuje da su podaci koje unosi tačni, potpuni i ažurni.
            </li>
            <li>
              Upravnik garantuje da ima ovlašćenje za zgradu koju dodaje / održava.
            </li>
            <li>
              Upravnik je odgovoran za neistinite, nepotpune ili obmanjujuće podatke.
            </li>
            <li>Svaka finansijska stavka treba da ima pisani trag i dokaz gde je potrebno.</li>
            <li>Podaci ne smeju kršiti privatnost stanara.</li>
            <li>
              Platforma nije sudski organ; služi kao alat za transparentnost i evidenciju.
            </li>
            <li>Zloupotrebe mogu dovesti do suspenzije naloga.</li>
          </ul>

          <h2>Pravila za recenzije</h2>
          <ul>
            <li>Recenzije treba da budu istinite i zasnovane na realnom iskustvu.</li>
            <li>Zabranjen je govor mržnje, uvrede i deljenje privatnih podataka.</li>
            <li>Admin može sakriti ili ukloniti sadržaj koji krši pravila.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

