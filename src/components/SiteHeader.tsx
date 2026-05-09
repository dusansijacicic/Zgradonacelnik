import Image from "next/image";
import Link from "next/link";

const nav = [
  { href: "/", label: "Početna" },
  { href: "/pretraga", label: "Pretraga" },
  { href: "/login", label: "Prijava" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-sky/30 bg-surface/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface/90">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
        >
          <Image
            src="/zgradonacelnik_logo.jpeg"
            alt="Zgradonačelnik.rs"
            width={220}
            height={80}
            className="h-10 w-auto object-contain object-left sm:h-12"
            priority
          />
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-0.5 sm:gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-sky-muted hover:text-brand-navy-deep sm:px-3"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
