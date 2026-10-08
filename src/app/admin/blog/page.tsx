import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/blog";

export default async function AdminBlogPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/blog");
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: posts, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, status, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-4xl space-y-4">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">← Admin</Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Blog</h1>
            <Link href="/admin/blog/novi" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
              + Novi tekst
            </Link>
          </div>
          {error ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Tabela za blog ne postoji — pokreni migraciju 0012 u Supabase-u.
            </p>
          ) : null}
          <div className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {(posts ?? []).map((p) => (
              <Link key={p.id} href={`/admin/blog/${p.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{p.title}</span>
                <span className="text-xs text-zinc-400">/blog/{p.slug}</span>
                {p.status === "published" ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    Objavljeno {formatDate(p.published_at)}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Nacrt</span>
                )}
              </Link>
            ))}
            {!posts?.length && !error ? <div className="p-4 text-sm text-zinc-500">Još nema tekstova.</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
