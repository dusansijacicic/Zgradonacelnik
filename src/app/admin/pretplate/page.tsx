import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminPlansClient from "./ui";

export default async function AdminSubscriptionsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/pretplate");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("id, name, price_monthly, max_buildings, features, active")
    .order("price_monthly", { ascending: true });

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Pretplate (planovi)
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            MVP: CRUD za `subscription_plans` (bez plaćanja).
          </p>
          <AdminPlansClient initial={plans ?? []} />
        </div>
      </main>
    </div>
  );
}

