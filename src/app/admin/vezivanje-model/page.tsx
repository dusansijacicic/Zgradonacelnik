import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminVezivanjeModelPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/vezivanje-model");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-3xl space-y-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-500">
            <Link href="/admin" className="font-medium text-zinc-800 underline-offset-2 hover:underline">
              ← Admin
            </Link>
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
            Kako se vežu članovi i upravnici za zgradu (MVP)
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            U bazi postoje dve odvojene veze: <strong>članstvo</strong> (stanar / član SZ) i{" "}
            <strong>dodela upravnika</strong> (profesionalni upravnik nad zgradom). One se ne
            mešaju automatski.
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">1. Zgrada</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Tabela <code className="rounded bg-zinc-100 px-1.5 text-xs">public.buildings</code>.
            Jedinstvena adresa kroz <code className="text-xs">address_hash</code>.
          </p>
          <ul className="mt-3 list-inside list-disc text-sm text-zinc-700">
            <li>
              UI:{" "}
              <Link
                href="/dashboard/moje-zgrade/nova"
                className="font-medium text-emerald-800 underline-offset-2 hover:underline"
              >
                Dashboard → Moje zgrade → Dodaj zgradu
              </Link>
            </li>
            <li>
              API: <code className="text-xs">POST /api/buildings/create</code>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">2. Član ↔ zgrada</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Tabela{" "}
            <code className="rounded bg-zinc-100 px-1.5 text-xs">public.building_memberships</code>{" "}
            — kolone <code className="text-xs">building_id</code>, <code className="text-xs">user_id</code>
            , <code className="text-xs">role</code> (npr. <code className="text-xs">resident</code>),{" "}
            <code className="text-xs">verification_status</code>.
          </p>
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 font-mono text-xs leading-relaxed text-zinc-800">
            [Korisnik]──insert──▶[building_memberships]◀──FK──[buildings]
            <br />
            <span className="text-zinc-600">
              (RLS: politika „insert self“ — korisnik sme da doda sam sebe kao člana.)
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            <strong>Šta radi kod danas:</strong> pri kreiranju zgrade API automatski upiše članstvo
            za <em>kreatora</em> kao <code className="text-xs">resident</code> sa{" "}
            <code className="text-xs">verification_status = unverified</code> (
            <code className="text-xs">src/app/api/buildings/create/route.ts</code>).
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            <strong>Šta još nije u UI-ju:</strong> poseban korak „Prijavi se u ovu zgradu“ za druge
            stanare — u šemi je dozvoljeno (insert self), ali treba forma / link ili pozivnica
            (kasnije).
          </p>
          <p className="mt-2 text-sm">
            <Link href="/dashboard/moje-zgrade" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
              Moje zgrade (lista članstva) →
            </Link>
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">3. Upravnik ↔ zgrada</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Tabela{" "}
            <code className="rounded bg-zinc-100 px-1.5 text-xs">
              public.building_manager_assignments
            </code>
            : <code className="text-xs">building_id</code>, <code className="text-xs">manager_user_id</code>
            , <code className="text-xs">status</code> (<code className="text-xs">pending</code> →{" "}
            <code className="text-xs">active</code> / <code className="text-xs">rejected</code> /{" "}
            <code className="text-xs">ended</code>), opciono <code className="text-xs">proof_document_id</code>
            .
          </p>
          <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-zinc-800">
            <div className="font-mono text-xs leading-relaxed">
              [Upravnik user]──POST /api/assignments/request──▶[assignment: pending]
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;▼
              <br />
              [Admin]──POST /api/admin/assignments──▶[assignment: active | rejected | ended]
            </div>
            <p className="text-xs text-zinc-700">
              Uslov za zahtev: u <code className="text-xs">user_profiles</code> mora{" "}
              <code className="text-xs">user_type = professional_manager</code> i{" "}
              <code className="text-xs">professional_manager_status = verified</code>.
            </p>
          </div>
          <ul className="mt-4 list-inside list-disc text-sm text-zinc-700">
            <li>
              Zahtev: <code className="text-xs">POST /api/assignments/request</code> (telo:{" "}
              <code className="text-xs">building_id</code>, <code className="text-xs">proof_document_id</code>
              , opciono <code className="text-xs">start_date</code>)
            </li>
            <li>
              Upravnik vidi liste:{" "}
              <Link href="/manager/zgrade" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
                /manager/zgrade
              </Link>{" "}
              (MVP prikazuje ID zgrade; detalji mogu kasnije).
            </li>
            <li>
              Admin odobrava:{" "}
              <Link
                href="/admin/zgrade-upravnici"
                className="font-medium text-emerald-800 underline-offset-2 hover:underline"
              >
                /admin/zgrade-upravnici
              </Link>{" "}
              → <code className="text-xs">POST /api/admin/assignments</code> (
              <code className="text-xs">approve</code> / <code className="text-xs">reject</code> /{" "}
              <code className="text-xs">end</code>)
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">4. Šta nije ista veza</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Član u <code className="text-xs">building_memberships</code> <strong>ne postaje</strong>{" "}
            automatski upravnik u <code className="text-xs">building_manager_assignments</code>. Upravnik
            mora imati svoj verifikacioni tok i eksplicitan zahtev + admin odobrenje.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">5. SQL brza provera (Supabase)</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100">
{`-- Članstva po zgradi
select * from public.building_memberships where building_id = 'UUID_ZGRADE';

-- Dodele upravnika
select * from public.building_manager_assignments where building_id = 'UUID_ZGRADE';`}
          </pre>
        </section>
      </main>
    </div>
  );
}
