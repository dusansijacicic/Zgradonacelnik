import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const head = { count: "exact" as const, head: true };
  const [orders, memberships, assignments, reviews, reports] = await Promise.all([
    supabase.from("subscription_orders").select("id", head).eq("status", "pending_payment"),
    supabase.from("building_memberships").select("id", head).eq("verification_status", "pending"),
    supabase.from("building_manager_assignments").select("id", head).eq("status", "pending"),
    supabase.from("manager_reviews").select("id", head).eq("status", "pending"),
    supabase.from("review_reports").select("id", head).eq("status", "open"),
  ]);

  const links: { href: string; label: string; badge?: number | null }[] = [
    { href: "/admin/pretplate", label: "Uplate / Premium", badge: orders.count },
    { href: "/admin/clanstva", label: "Potvrde stanara", badge: memberships.count },
    { href: "/admin/zgrade-upravnici", label: "Upravnik ↔ zgrada", badge: assignments.count },
    { href: "/admin/recenzije", label: "Moderacija recenzija", badge: reviews.count },
    { href: "/admin/prijave-recenzija", label: "Prijave recenzija", badge: reports.count },
    { href: "/admin/blog", label: "Blog" },
    { href: "/admin/registar-upravnika", label: "Registar upravnika (sinhronizacija)" },
    { href: "/admin/pozivi-upravnicima", label: "Pozivi upravnicima" },
    { href: "/admin/verifikacije", label: "Zahtevi za verifikaciju upravnika" },
    { href: "/admin/audit-log", label: "Audit log" },
    { href: "/admin/vezivanje-model", label: "Kako sistem radi" },
  ];

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Admin panel</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                {l.label}
                {l.badge ? (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{l.badge}</span>
                ) : (
                  <span className="text-zinc-400">→</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
