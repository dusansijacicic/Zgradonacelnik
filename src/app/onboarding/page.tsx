import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import OnboardingClient from "./ui";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, user_type, municipality, city, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  // Already onboarded — send to dashboard
  if (profile?.onboarding_completed) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10">
      <OnboardingClient
        initialFirstName={profile?.first_name ?? ""}
        initialLastName={profile?.last_name ?? ""}
        initialUserType={(profile?.user_type as string | null) ?? "resident"}
        initialMunicipality={profile?.municipality ?? ""}
        initialCity={profile?.city ?? ""}
        email={user.email ?? ""}
      />
    </div>
  );
}
