import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminPretplateClient from "./ui";

export default async function AdminPretplatePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/pretplate");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: subscriptions } = await supabase
    .from("building_subscriptions")
    .select(`
      id, status, payment_reference, amount_rsd,
      current_period_start, current_period_end, created_at,
      building_id,
      buildings ( street, street_number, city, municipality ),
      user_profiles!building_subscriptions_subscribed_by_fkey ( display_name, first_name, last_name )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-5xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Premium pretplate zgrada
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Ručna aktivacija po uplati. Refentni broj je jedinstven po zgradi.
          </p>
          <AdminPretplateClient initial={(subscriptions as any[]) ?? []} />
        </div>
      </main>
    </div>
  );
}
