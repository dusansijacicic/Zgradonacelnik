import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ManagerHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("professional_manager_status, user_type")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Panel upravnika
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Status:{" "}
            <span className="font-medium text-zinc-900">
              {profile?.professional_manager_status ?? "nepoznato"}
            </span>
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/manager/verifikacija"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Verifikacija →
            </Link>
            <Link
              href="/manager/recenzije"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Recenzije →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

