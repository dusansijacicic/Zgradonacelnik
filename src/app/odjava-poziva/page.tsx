import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifySignedToken } from "@/lib/otp";

/**
 * Odjava upravnika od poziva. Potvrda ide preko forme (POST), jer skeneri mejlova
 * automatski otvaraju linkove (GET) i odjavili bi ljude bez njihove volje.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string; done?: string }>;
}) {
  const { id = "", t = "", done } = await searchParams;
  const valid = /^\d+$/.test(id) && verifySignedToken(`unsub:${id}`, t);

  async function unsubscribe(formData: FormData) {
    "use server";
    const rid = String(formData.get("id") ?? "");
    const tok = String(formData.get("t") ?? "");
    if (!/^\d+$/.test(rid) || !verifySignedToken(`unsub:${rid}`, tok)) return;
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin.from("professional_manager_registry").select("normalized_email").eq("id", Number(rid)).maybeSingle();
    if (row?.normalized_email) {
      await admin.from("professional_manager_registry").update({ email_opt_out: true }).eq("normalized_email", row.normalized_email);
    }
    redirect(`/odjava-poziva?done=1`);
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {done ? (
          <>
            <h1 className="text-lg font-semibold text-zinc-900">Odjavljeni ste</h1>
            <p className="mt-2 text-sm text-zinc-600">Više Vam nećemo slati pozive. Profil iz javnog registra i dalje postoji.</p>
          </>
        ) : valid ? (
          <form action={unsubscribe}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="t" value={t} />
            <h1 className="text-lg font-semibold text-zinc-900">Odjava od poruka</h1>
            <p className="mt-2 text-sm text-zinc-600">Ne želite više pozive sa Zgradonačelnik.rs?</p>
            <button className="mt-6 h-11 w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white">Odjavi me</button>
          </form>
        ) : (
          <p className="text-sm text-zinc-600">Link nije ispravan.</p>
        )}
      </main>
    </div>
  );
}
