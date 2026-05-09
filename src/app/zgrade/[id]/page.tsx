import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AssignmentRequestClient from "./ui";
import RegistryManagerSuggestClient from "./suggest-registry-ui";

export default async function BuildingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}`);

  const { data: building } = await supabase
    .from("buildings")
    .select("id, city, municipality, street, street_number, entrance, status")
    .eq("id", id)
    .maybeSingle();

  if (!building) notFound();

  const { data: membership } = await supabase
    .from("building_memberships")
    .select("role, verification_status")
    .eq("building_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type, professional_manager_status, is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {building.street} {building.street_number}
            {building.entrance ? `, ulaz ${building.entrance}` : ""}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {building.city}
            {building.municipality ? ` • ${building.municipality}` : ""} • status:{" "}
            <span className="font-medium text-zinc-900">{building.status}</span>
          </p>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Tvoje članstvo:{" "}
            <span className="font-medium text-zinc-900">
              {membership?.role ?? "nema"} / {membership?.verification_status ?? "—"}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Link
              href={`/zgrade/${id}/oglasna-tabla`}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Oglasna tabla →
            </Link>
            <Link
              href={`/zgrade/${id}/predlozi`}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Predlozi radova →
            </Link>
            <Link
              href={`/zgrade/${id}/finansije`}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Finansije (MVP) →
            </Link>
            <Link
              href={`/zgrade/${id}/dokumenta`}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Dokumenta →
            </Link>
          </div>

          <AssignmentRequestClient
            buildingId={id}
            canRequest={
              profile?.user_type === "professional_manager" &&
              profile?.professional_manager_status === "verified"
            }
          />

          {membership?.verification_status === "verified" ? (
            <RegistryManagerSuggestClient buildingId={id} />
          ) : (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
              Kada admin verifikuje tvoje članstvo u zgradi, ovde ćeš moći da predložiš upravnika iz
              državnog registra (čak i ako još nema nalog na platformi).
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

