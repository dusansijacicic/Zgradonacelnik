import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findRegistryByEmail } from "@/lib/registryClaim";
import VerificationClient from "./ui";

export default async function ManagerVerificationPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/verifikacija");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type, professional_manager_status, registry_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const verified = profile?.user_type === "professional_manager" && profile.professional_manager_status === "verified";

  const { data: registryRow } = profile?.registry_id
    ? await supabase
        .from("professional_manager_registry")
        .select("id, full_name, municipality, license_number")
        .eq("id", profile.registry_id)
        .maybeSingle()
    : { data: null };

  // Ako je email naloga već u registru — ponudi potvrdu jednim klikom.
  const ownEmailMatch =
    !verified && user.email && user.email_confirmed_at ? await findRegistryByEmail(user.email).catch(() => null) : null;
  const ownCandidates = (ownEmailMatch?.candidates ?? []).filter((c) => !c.claimed_by || c.claimed_by === user.id);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl space-y-4">
        <Link href="/manager" className="text-sm text-zinc-500 hover:text-zinc-800">← Panel upravnika</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Potvrda profesionalnog upravnika</h1>

          {verified ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="font-semibold">✓ Verifikovan profesionalni upravnik</div>
              {registryRow ? (
                <div className="mt-1">
                  {registryRow.full_name}
                  {registryRow.license_number ? ` · licenca br. ${registryRow.license_number}` : ""}
                  {registryRow.municipality ? ` · ${registryRow.municipality}` : ""}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/manager/zgrade/nova" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">
                  + Dodaj zgradu koju upravljaš
                </Link>
                <Link href="/manager/ponude" className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  Ponudi usluge zgradama →
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-600">
                Na platformi upravnik može biti samo osoba iz{" "}
                <a href="https://usluge.pks.rs/portal/registar-upravnika-zgrada" target="_blank" rel="noreferrer" className="underline">
                  registra profesionalnih upravnika (PKS)
                </a>
                . Potvrda ide preko email adrese koja je upisana u registar.
              </p>
              {profile?.professional_manager_status === "expired" ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Tvoja licenca više nije u aktivnom registru PKS. Ako je to greška, javi se na kontakt stranici.
                </div>
              ) : null}
              <VerificationClient
                defaultEmail={user.email ?? ""}
                ownEmailCandidates={ownCandidates.map((c) => ({
                  id: c.id,
                  full_name: c.full_name,
                  municipality: c.municipality,
                  license_number: c.license_number,
                }))}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
