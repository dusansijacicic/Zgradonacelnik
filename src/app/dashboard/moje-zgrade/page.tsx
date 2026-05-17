import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MyBuildingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/moje-zgrade");

  const { data: memberships } = await supabase
    .from("building_memberships")
    .select(`
      id, role, verification_status, building_id, apartment_label,
      buildings ( street, street_number, entrance, city, municipality, status )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const STATUS_COLOR: Record<string, string> = {
    verified: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-800",
    unverified: "bg-zinc-100 text-zinc-600",
    rejected: "bg-red-100 text-red-800",
  };

  const ROLE_LABELS: Record<string, string> = {
    resident: "Stanar", owner: "Vlasnik", tenant: "Zakupac",
    board_member: "Član saveta", manager: "Upravnik", former_manager: "Bivši upravnik",
  };

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Moje zgrade</h1>
            <Link
              href="/dashboard/moje-zgrade/nova"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              + Dodaj zgradu
            </Link>
          </div>

          {!memberships?.length ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
              <p className="text-sm text-zinc-600">Još uvek nisi dodat ni u jednu zgradu.</p>
              <p className="mt-1 text-sm text-zinc-500">
                Klikni "Dodaj zgradu" da pronađeš svoju zgradu i podneseš zahtev za članstvo.
              </p>
              <Link
                href="/dashboard/moje-zgrade/nova"
                className="mt-4 inline-flex h-10 items-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
              >
                + Dodaj svoju zgradu
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {memberships.map((m) => {
                const b = m.buildings as any;
                const address = b
                  ? `${b.street} ${b.street_number}${b.entrance ? `, ulaz ${b.entrance}` : ""}`
                  : m.building_id;
                const location = b ? `${b.city}${b.municipality ? ` • ${b.municipality}` : ""}` : "";

                return (
                  <div key={m.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <Link
                          href={`/zgrade/${m.building_id}`}
                          className="text-sm font-semibold text-zinc-900 hover:underline"
                        >
                          {address}
                        </Link>
                        {location && (
                          <div className="mt-0.5 text-xs text-zinc-500">{location}</div>
                        )}
                        {m.apartment_label && (
                          <div className="mt-0.5 text-xs text-zinc-500">Stan: {m.apartment_label}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[m.verification_status] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {m.verification_status === "verified" ? "Verifikovano"
                            : m.verification_status === "pending" ? "Na čekanju"
                            : m.verification_status === "rejected" ? "Odbijeno"
                            : "Neverifikovano"}
                        </span>
                      </div>
                    </div>

                    {m.verification_status === "unverified" && (
                      <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        Tvoje članstvo čeka verifikaciju. Admin treba da odobri tvoj zahtev.
                        Možeš ubrzati proces slanjem dokaza stanovanja.{" "}
                        <Link href={`/zgrade/${m.building_id}`} className="font-medium underline underline-offset-2">
                          Otvori zgradu →
                        </Link>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/zgrade/${m.building_id}`}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Otvori zgradu →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
