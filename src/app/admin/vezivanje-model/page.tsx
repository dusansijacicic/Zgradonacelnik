import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLinkModelPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/vezivanje-model");
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const sections: { title: string; items: string[] }[] = [
    {
      title: "1. Adresa → zgrada (jedinstvena)",
      items: [
        "Adresu korisnik bira iz Google Places predloga; server ponovo proverava place_id kod Google-a i zahteva kućni broj.",
        "find_or_create_building: prvo traži po google_place_id + ulaz, pa po normalizovanoj adresi (grad + ulica + broj + ulaz), tek onda pravi novu zgradu.",
        "Zgradu ne može napraviti klijent direktno (RLS) — samo server preko service_role.",
      ],
    },
    {
      title: "2. Stanar ↔ zgrada",
      items: [
        "Onboarding: ime, prezime, godište, adresa stanovanja → neverifikovano članstvo (vlasnik / zakupac / član domaćinstva).",
        "Stanar šalje dokaz → status 'pending'. Potvrđuje aktivni upravnik zgrade (/zgrade/[id]/clanovi) ili admin (/admin/clanstva).",
        "Korisnik ne može sam sebi da promeni verifikaciju (trigger u bazi).",
      ],
    },
    {
      title: "3. Upravnik ↔ registar",
      items: [
        "Upravnik postaje verifikovan samo emailom iz AKTIVNOG reda PKS registra: automatski ako se prijavio tom adresom, inače OTP na tu adresu.",
        "claim_registry_entry veže nalog za red registra (1:1) i prebacuje recenzije/predloge koje su stanari vezali za taj red.",
        "Sinhronizacija registra nikad ne briše redove; 'Obrisan iz registra' / nestali → neaktivni, a nalog gubi verifikaciju.",
      ],
    },
    {
      title: "4. Upravnik ↔ zgrada",
      items: [
        "Upravnik dodaje zgradu (adresa + dokaz ovlašćenja) ili stanar označi upravnika iz registra → veza 'pending'.",
        "Admin odobrava u /admin/zgrade-upravnici; odobrenjem novog, prethodni aktivni upravnik prelazi u 'ended' (istorija ostaje).",
        "Upravnici bez zgrade šalju ponude zgradama bez upravnika; članovi zgrade ih vide i dobijaju email.",
      ],
    },
    {
      title: "5. Premium",
      items: [
        "Plaća se po zgradi mesečno; upravnik poruči za jednu ili više zgrada → jedan poziv na broj (model 97).",
        "Admin potvrđuje uplatu u /admin/pretplate → activate_subscription_order produžava period svakoj zgradi.",
        "Dnevni cron označava istekle i šalje podsetnik 7 dana pre isteka.",
      ],
    },
  ];

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl space-y-4">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">← Admin</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Kako rade veze: adresa – stanar – upravnik – Premium</h1>
          {sections.map((s) => (
            <section key={s.title} className="mt-6">
              <h2 className="text-sm font-semibold text-zinc-900">{s.title}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
