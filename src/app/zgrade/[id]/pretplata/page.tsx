import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBuildingSubscription } from "@/lib/buildingPremium";
import PretplataClient from "./ui";

export default async function BuildingPretplataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/zgrade/${encodeURIComponent(id)}/pretplata`);

  const { data: building } = await supabase
    .from("buildings")
    .select("id, city, municipality, street, street_number, entrance")
    .eq("id", id)
    .maybeSingle();
  if (!building) notFound();

  // Check if caller is active manager
  const { data: assignment } = await supabase
    .from("building_manager_assignments")
    .select("id")
    .eq("building_id", id)
    .eq("manager_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const subscription = await getBuildingSubscription(supabase, id);

  const address = [
    building.street,
    building.street_number,
    building.entrance ? `ulaz ${building.entrance}` : null,
    building.city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-2xl">
        <PretplataClient
          buildingId={id}
          address={address}
          isManager={!!assignment}
          subscription={subscription}
          paymentAccountNumber={process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER ?? ""}
          paymentModel={process.env.NEXT_PUBLIC_PAYMENT_MODEL ?? "97"}
        />
      </main>
    </div>
  );
}
