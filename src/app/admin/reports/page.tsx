import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminReportsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/reports");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Reports (MVP)
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Mesto za sve prijave (zloupotrebe, sporne zgrade, recenzije...). Trenutno
          imamo posebnu stranicu za prijave recenzija:{" "}
          <a className="underline underline-offset-4" href="/admin/prijave-recenzija">
            /admin/prijave-recenzija
          </a>
          .
        </p>
      </main>
    </div>
  );
}

