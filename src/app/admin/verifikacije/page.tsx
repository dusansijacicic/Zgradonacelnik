import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminVerificationClient from "./ui";

export default async function AdminVerificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/verifikacije");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: requests } = await supabase
    .from("manager_verification_requests")
    .select("id, user_id, requested_email, requested_phone, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Verifikacije upravnika
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Odobri/odbij zahteve. OTP verifikacija može automatski postaviti
            status na verified, ali admin može korigovati.
          </p>

          <AdminVerificationClient requests={requests ?? []} />
        </div>
      </main>
    </div>
  );
}

