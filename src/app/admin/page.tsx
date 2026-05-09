import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Admin panel (MVP)
          </h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin/verifikacije"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Verifikacije upravnika →
            </Link>
            <Link
              href="/admin/registar-upravnika"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Import registra upravnika →
            </Link>
            <Link
              href="/admin/recenzije"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Moderacija recenzija →
            </Link>
            <Link
              href="/admin/zgrade-upravnici"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Zgrade ↔ upravnici (odobravanja) →
            </Link>
            <Link
              href="/admin/vezivanje-model"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Kako rade veze član–zgrada–upravnik →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

