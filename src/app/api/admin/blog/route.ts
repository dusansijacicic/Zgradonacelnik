import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser, isAdmin, jsonError } from "@/lib/api";
import { slugify } from "@/lib/seo";

const postSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().max(120).optional(),
  title: z.string().trim().min(5).max(160),
  excerpt: z.string().trim().max(400).default(""),
  content_md: z.string().max(100_000).default(""),
  cover_image_url: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  seo_title: z.string().trim().max(70).nullable().optional(),
  seo_description: z.string().trim().max(170).nullable().optional(),
  status: z.enum(["draft", "published"]),
});

function revalidateBlog(slugs: (string | null | undefined)[]) {
  revalidatePath("/blog");
  revalidatePath("/blog/rss.xml");
  revalidatePath("/sitemap.xml");
  for (const s of slugs) if (s) revalidatePath(`/blog/${s}`);
}

/** Kreiranje/izmena teksta (admin). Objava odmah osvežava keširane stranice bloga. */
export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  if (!(await isAdmin(supabase, user.id))) return jsonError("forbidden", 403);

  const body = postSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    const f = body.error.issues[0]?.path[0];
    return jsonError("bad_request", 400, f === "title" ? "Naslov mora imati 5–160 karaktera." : `Proveri polje: ${String(f)}`);
  }
  const d = body.data;
  const slug = slugify(d.slug || d.title).slice(0, 100);
  if (!slug) return jsonError("bad_slug", 400, "Adresa teksta (slug) nije validna.");

  const { data: previous } = d.id
    ? await supabase.from("blog_posts").select("slug, status, published_at").eq("id", d.id).maybeSingle()
    : { data: null };

  const row = {
    slug,
    title: d.title,
    excerpt: d.excerpt,
    content_md: d.content_md,
    cover_image_url: d.cover_image_url || null,
    tags: d.tags,
    seo_title: d.seo_title || null,
    seo_description: d.seo_description || null,
    status: d.status,
    published_at:
      d.status === "published" ? previous?.published_at ?? new Date().toISOString() : previous?.published_at ?? null,
  };

  const result = d.id
    ? await supabase.from("blog_posts").update(row).eq("id", d.id).select("id, slug").single()
    : await supabase.from("blog_posts").insert({ ...row, created_by: user.id }).select("id, slug").single();

  if (result.error) {
    if (result.error.code === "23505") return jsonError("slug_taken", 409, "Tekst sa ovom adresom već postoji.");
    return jsonError("db_error", 500, result.error.message);
  }

  revalidateBlog([slug, previous?.slug]);
  return NextResponse.json({ id: result.data.id, slug: result.data.slug });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return jsonError("unauthorized", 401);
  if (!(await isAdmin(supabase, user.id))) return jsonError("forbidden", 403);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("bad_request", 400);

  const { data: post } = await supabase.from("blog_posts").delete().eq("id", id).select("slug").maybeSingle();
  revalidateBlog([post?.slug]);
  return NextResponse.json({ ok: true });
}
