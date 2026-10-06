import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import InvitesClient from "./ui";

export default async function AdminInvitesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/pozivi-upravnicima");
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const head = { count: "exact" as const, head: true };
  const base = () =>
    supabase.from("professional_manager_registry").select("id", head).eq("is_active", true).not("normalized_email", "is", null);
  const [withEmail, notInvited, invited, optedOut, claimed] = await Promise.all([
    base(),
    base().eq("invite_count", 0).eq("email_opt_out", false),
    base().gt("invite_count", 0),
    base().eq("email_opt_out", true),
    supabase.from("user_profiles").select("user_id", head).not("registry_id", "is", null),
  ]);

  const stats = [
    { label: "Aktivni sa emailom", value: withEmail.count ?? 0 },
    { label: "Još nisu pozvani", value: notInvited.count ?? 0 },
    { label: "Pozvani", value: invited.count ?? 0 },
    { label: "Preuzeli profil", value: claimed.count ?? 0 },
    { label: "Odjavljeni", value: optedOut.count ?? 0 },
  ];

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl space-y-4">
        <Link href="/admin/registar-upravnika" className="text-sm text-zinc-500 hover:text-zinc-800">← Registar</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Pozivi upravnicima iz registra</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Upravnik dobija mejl sa linkom za prijavu svojom adresom iz registra — verifikacija je tada automatska.
            Svaki mejl ima link za odjavu. Šalji u manjim turama (Resend besplatan plan: 100 mejlova dnevno) i prati
            odziv pre slanja svima.
          </p>
          {process.env.TEST_EMAIL ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              TEST mod je uključen (TEST_EMAIL) — svi pozivi idu na {process.env.TEST_EMAIL} i upravnici se NE označavaju kao pozvani.
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-200 p-3">
                <div className="text-[11px] text-zinc-500">{s.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
          <InvitesClient />
        </div>
      </main>
    </div>
  );
}
