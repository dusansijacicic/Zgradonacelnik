import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MyBuildingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/moje-zgrade");

  const { data: memberships } = await supabase
    .from("building_memberships")
    .select("id, role, verification_status, building_id, apartment_label, buildings(street, street_number, entrance, city, municipality, status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    verified:   { label: "Verifikovano",   cls: "bg-emerald-100 text-emerald-800" },
    pending:    { label: "Na čekanju",     cls: "bg-amber-100 text-amber-700" },
    unverified: { label: "Neverifikovano", cls: "bg-zinc-100 text-zinc-600" },
    rejected:   { label: "Odbijeno",       cls: "bg-red-100 text-red-700" },
  };
  const ROLE_MAP: Record<string, string> = {
    resident: "Stanar", owner: "Vlasnik", tenant: "Zakupac",
    board_member: "Član saveta", manager: "Upravnik", former_manager: "Bivši upravnik",
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <div className="bg-white border-b border-zinc-200 px-4 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600">← Dashboard</Link>
            <h1 className="mt-1 text-xl font-bold text-zinc-900">Moje zgrade</h1>
          </div>
          <Link
            href="/dashboard/moje-zgrade/nova"
            className="flex items-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-navy-deep"
          >
            + Dodaj zgradu
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        {!memberships?.length ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-3xl">
              🏢
            </div>
            <h3 className="font-semibold text-zinc-800">Još nisi u nijednoj zgradi</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Pronađi svoju adresu i pridruži se zgradi.
            </p>
            <Link
              href="/dashboard/moje-zgrade/nova"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-6 py-3 text-sm font-semibold text-white hover:bg-brand-navy-deep"
            >
              Pronađi svoju zgradu →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {memberships.map((m) => {
              const b = m.buildings as any;
              const address = b
                ? `${b.street} ${b.street_number}${b.entrance ? `, ulaz ${b.entrance}` : ""}`
                : m.building_id;
              const location = b ? `${b.city}${b.municipality ? ` · ${b.municipality}` : ""}` : "";
              const st = STATUS_MAP[m.verification_status] ?? { label: m.verification_status, cls: "bg-zinc-100 text-zinc-600" };

              return (
                <div key={m.id} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                  <Link
                    href={`/zgrade/${m.building_id}`}
                    className="flex items-center gap-4 p-4 transition hover:bg-zinc-50"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-sky-muted text-2xl">
                      🏢
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-zinc-900 truncate">{address}</div>
                      <div className="mt-0.5 text-xs text-zinc-400">{location}</div>
                      {m.apartment_label && (
                        <div className="mt-0.5 text-xs text-zinc-400">Stan: {m.apartment_label}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                        {ROLE_MAP[m.role] ?? m.role}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                  </Link>

                  {m.verification_status === "unverified" && (
                    <div className="border-t border-amber-100 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
                      <p className="text-xs text-amber-800">
                        Pošalji dokaz stanovanja da ubrzaš verifikaciju.
                      </p>
                      <Link
                        href={`/zgrade/${m.building_id}`}
                        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Otvori →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
