import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, first_name, last_name, oauth_address_line, oauth_address_synced_at, city, municipality, google_phone_raw, google_phone_normalized, google_identity_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const maskPhone = (raw: string | null | undefined) => {
    if (!raw?.trim()) return null;
    const d = raw.replace(/\D/g, "");
    if (d.length < 4) return "•••";
    return `••••${d.slice(-4)}`;
  };

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl space-y-4">

        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800">← Dashboard</Link>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Moj profil</h1>
              <p className="mt-0.5 text-sm text-zinc-500">{user.email}</p>
            </div>
            <LogoutButton className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50" />
          </div>

          <div className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-zinc-50">
            <div className="px-4 py-3">
              <div className="text-xs font-medium text-zinc-500">Ime i prezime</div>
              <div className="mt-0.5 text-sm text-zinc-900">
                {displayName ?? "—"}
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="text-xs font-medium text-zinc-500">Email</div>
              <div className="mt-0.5 text-sm text-zinc-900 break-all">{user.email}</div>
            </div>

            <div className="px-4 py-3">
              <div className="text-xs font-medium text-zinc-500">Telefon (Google, maskiran)</div>
              <div className="mt-0.5 text-sm font-mono text-zinc-900">
                {maskPhone(profile?.google_phone_raw) ?? (
                  <span className="font-sans text-zinc-400 italic">Nije sinhronizovan</span>
                )}
              </div>
              {profile?.google_identity_synced_at && (
                <div className="mt-0.5 text-xs text-zinc-400">
                  Sinhronizacija: {new Date(profile.google_identity_synced_at).toLocaleString("sr-RS")}
                </div>
              )}
            </div>

            <div className="px-4 py-3">
              <div className="text-xs font-medium text-zinc-500">Adresa iz Google naloga</div>
              <div className="mt-0.5 text-sm text-zinc-900">
                {profile?.oauth_address_line ?? (
                  <span className="text-zinc-400 italic">Nije dostupna</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard/moje-zgrade"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Moje zgrade →
            </Link>
            <Link
              href="/dashboard/moje-zgrade/nova"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
            >
              + Dodaj zgradu
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
