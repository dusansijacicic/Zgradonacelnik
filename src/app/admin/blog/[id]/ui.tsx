"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import { slugify } from "@/lib/seo";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_md: string;
  cover_image_url: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  status: string;
};

const inputCls = "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm";

export default function BlogEditor({ initial }: { initial: Post | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content_md ?? "");
  const [cover, setCover] = useState(initial?.cover_image_url ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(initial?.seo_description ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const preview = useMemo(() => renderMarkdown(content), [content]);
  const effectiveSlug = slugTouched ? slugify(slug) : slugify(title);
  const isPublished = initial?.status === "published";

  async function save(status: "draft" | "published") {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/blog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        slug: effectiveSlug,
        title,
        excerpt,
        content_md: content,
        cover_image_url: cover || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        seo_title: seoTitle || null,
        seo_description: seoDesc || null,
        status,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; slug?: string; error?: string; detail?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ text: json.detail ?? json.error ?? "Greška", ok: false });
    setMsg({ text: status === "published" ? "Objavljeno — vidljivo odmah na /blog." : "Sačuvano kao nacrt.", ok: true });
    if (!initial && json.id) router.replace(`/admin/blog/${json.id}`);
    else router.refresh();
  }

  async function remove() {
    if (!initial) return;
    setBusy(true);
    await fetch(`/api/admin/blog?id=${initial.id}`, { method: "DELETE" });
    router.replace("/admin/blog");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <input
          id="blog-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Naslov teksta"
          className="w-full border-0 text-2xl font-bold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300"
        />
        <div className="mt-1 text-xs text-zinc-400">/blog/{effectiveSlug || "…"}</div>

        <div className="mt-4 flex gap-1 border-b border-zinc-100">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500"
              }`}
            >
              {t === "edit" ? "Pisanje (Markdown)" : "Pregled"}
            </button>
          ))}
        </div>
        {tab === "edit" ? (
          <textarea
            id="blog-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={26}
            placeholder={"## Podnaslov\n\nTekst… **podebljano**, [link](/pretraga), liste sa - ili 1."}
            className="mt-3 w-full resize-y rounded-lg border border-zinc-200 p-3 font-mono text-sm leading-relaxed"
          />
        ) : (
          <div className="prose-blog mt-4 min-h-[300px]" dangerouslySetInnerHTML={{ __html: preview }} />
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Objava</div>
          <div className="mt-2 text-sm text-zinc-700">Status: {isPublished ? "objavljeno" : "nacrt"}</div>
          <div className="mt-3 grid gap-2">
            <button
              disabled={busy || title.trim().length < 5}
              onClick={() => save("published")}
              className="h-10 rounded-lg bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPublished ? "Sačuvaj izmene" : "Objavi"}
            </button>
            <button
              disabled={busy || title.trim().length < 5}
              onClick={() => save("draft")}
              className="h-10 rounded-lg border border-zinc-200 text-sm text-zinc-800 disabled:opacity-50"
            >
              {isPublished ? "Vrati u nacrt" : "Sačuvaj nacrt"}
            </button>
            {isPublished ? (
              <a href={`/blog/${initial?.slug}`} target="_blank" rel="noreferrer" className="text-center text-xs text-zinc-500 underline">
                Otvori objavljeni tekst
              </a>
            ) : null}
          </div>
          {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p> : null}
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div>
            <label htmlFor="blog-excerpt" className="mb-1 block text-xs font-semibold text-zinc-600">Kratak opis (u listi i na Google-u)</label>
            <textarea id="blog-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} maxLength={400} className="w-full rounded-lg border border-zinc-200 p-2 text-sm" />
          </div>
          <div>
            <label htmlFor="blog-slug" className="mb-1 block text-xs font-semibold text-zinc-600">Adresa (slug)</label>
            <input
              id="blog-slug"
              value={slugTouched ? slug : effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="blog-tags" className="mb-1 block text-xs font-semibold text-zinc-600">Tagovi (zarez između)</label>
            <input id="blog-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="blog-cover" className="mb-1 block text-xs font-semibold text-zinc-600">Naslovna slika (URL, opciono)</label>
            <input id="blog-cover" value={cover} onChange={(e) => setCover(e.target.value)} className={inputCls} />
          </div>
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-zinc-600">SEO naslov i opis</summary>
            <div className="mt-2 space-y-2">
              <input id="blog-seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} placeholder="SEO naslov (do 60–70 znakova)" className={inputCls} />
              <textarea id="blog-seo-desc" value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} maxLength={170} rows={3} placeholder="Meta opis (do 160 znakova)" className="w-full rounded-lg border border-zinc-200 p-2 text-sm" />
              <div className="text-[11px] text-zinc-400">{seoDesc.length}/160</div>
            </div>
          </details>
        </div>

        {initial ? (
          <details className="rounded-2xl border border-red-100 bg-white p-4 text-sm">
            <summary className="cursor-pointer text-red-600">Obriši tekst</summary>
            <button disabled={busy} onClick={remove} className="mt-3 h-9 w-full rounded-lg bg-red-600 text-sm font-semibold text-white">
              Trajno obriši
            </button>
          </details>
        ) : null}
      </aside>
    </div>
  );
}
