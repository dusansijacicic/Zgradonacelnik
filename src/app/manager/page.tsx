import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ManagerHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("professional_manager_status, user_type, display_name, registry_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const verified = profile?.user_type === "professional_manager" && profile.professional_manager_status === "verified";
  if (!verified) redirect("/manager/verifikacija");

  const [{ data: assignments }, { count: pendingReviews }, { count: offers }] = await Promise.all([
    supabase.from("building_manager_assignments").select("status").eq("manager_user_id", user.id),
    supabase
      .from("manager_reviews")
      .select("id", { count: "exact", head: true })
      .eq("manager_user_id", user.id)
      .eq("status", "published"),
    supabase
      .from("manager_offers")
      .select("id", { count: "exact", head: true })
      .eq("manager_user_id", user.id)
      .eq("status", "sent"),
  ]);
  const active = (assignments ?? []).filter((a) => a.status === "active").length;
  const pending = (assignments ?? []).filter((a) => a.status === "pending").length;

  const tiles = [
    { href: "/manager/zgrade", title: "Moje zgrade", desc: `${active} aktivnih · ${pending} na čekanju` },
    { href: "/manager/zgrade/nova", title: "+ Dodaj zgradu", desc: "Adresa + dokaz ovlašćenja" },
    { href: "/manager/ponude", title: "Ponudi usluge", desc: `Zgrade bez upravnika · ${offers ?? 0} otvorenih ponuda` },
    { href: "/manager/pretplata", title: "Premium", desc: "Jedna uplata za više zgrada" },
    { href: "/manager/recenzije", title: "Recenzije", desc: `${pendingReviews ?? 0} objavljenih · odgovori stanarima` },
    { href: `/upravnik/${user.id}`, title: "Moj javni profil", desc: "Kako te vide stanari" },
  ];

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Panel upravnika</h1>
              <p className="mt-1 text-sm text-zinc-600">{profile?.display_name}</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              ✓ Verifikovan (PKS registar)
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((t) => (
              <Link key={t.href} href={t.href} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 hover:bg-zinc-100">
                <div className="text-sm font-semibold text-zinc-900">{t.title}</div>
                <div className="mt-1 text-xs text-zinc-500">{t.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
