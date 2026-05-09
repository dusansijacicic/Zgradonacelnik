import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import VerificationClient from "./ui";

export default async function ManagerVerificationPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/manager/verifikacija");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_type, professional_manager_status, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Verifikacija profesionalnog upravnika
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Status:{" "}
          <span className="font-medium text-zinc-900">
            {profile?.professional_manager_status ?? "nepoznato"}
          </span>
        </p>

        <VerificationClient />
      </main>
    </div>
  );
}

