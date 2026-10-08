import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BlogEditor from "./ui";

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/blog/${id}`);
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/dashboard");

  let post = null;
  if (id !== "novi") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, content_md, cover_image_url, tags, seo_title, seo_description, status")
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();
    post = data;
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10">
      <main className="w-full max-w-6xl space-y-4">
        <Link href="/admin/blog" className="text-sm text-zinc-500 hover:text-zinc-800">← Svi tekstovi</Link>
        <BlogEditor initial={post} />
      </main>
    </div>
  );
}
