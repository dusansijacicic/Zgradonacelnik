import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Za stanare",
    links: [
      { href: "/pretraga", label: "Pretraga upravnika" },
      { href: "/upravnici-zgrada", label: "Upravnici po mestima" },
      { href: "/pretraga/mapa", label: "Mapa upravnika" },
      { href: "/login", label: "Dodaj svoju zgradu" },
    ],
  },
  {
    title: "Upravnici zgrada",
    links: [
      { href: "/upravnici-zgrada/beograd-novi-beograd", label: "Novi Beograd" },
      { href: "/upravnici-zgrada/beograd-zvezdara", label: "Zvezdara" },
      { href: "/upravnici-zgrada/novi-sad", label: "Novi Sad" },
      { href: "/upravnici-zgrada/nis", label: "Niš" },
      { href: "/upravnici-zgrada/kragujevac", label: "Kragujevac" },
    ],
  },
  {
    title: "Saznajte više",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/pravila", label: "Pravila" },
      { href: "/kontakt", label: "Kontakt" },
      { href: "/prijava-zloupotrebe", label: "Prijava zloupotrebe" },
    ],
  },
  {
    title: "Pravno",
    links: [
      { href: "/uslovi", label: "Uslovi korišćenja" },
      { href: "/privatnost", label: "Politika privatnosti" },
    ],
  },
];

/** Statičan footer: interni linkovi pomažu Google-u da pronađe i rangira javne stranice. */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4 sm:px-6">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{col.title}</div>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} prefetch={false} className="text-sm text-slate-600 hover:text-slate-900">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Zgradonačelnik.rs · Podaci o upravnicima iz javnog registra Privredne komore Srbije
      </div>
    </footer>
  );
}
