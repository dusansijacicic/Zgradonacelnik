import { ImageResponse } from "next/og";
import { getPublishedPost } from "@/lib/blog";
import { loadGoogleFont } from "@/lib/ogFont";

export const alt = "Zgradonačelnik.rs blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  const title = post?.title ?? "Zgradonačelnik.rs blog";
  const label = "Zgradonačelnik.rs · Blog";
  const font = await loadGoogleFont("Geist", 800, title + label);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0f2744",
          color: "#ffffff",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: "#38bdf8" }}>{label}</div>
        <div style={{ display: "flex", fontSize: title.length > 60 ? 60 : 72, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5 }}>
          {title}
        </div>
        <div style={{ display: "flex", height: 8, width: 160, background: "#16a34a", borderRadius: 4 }} />
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Geist", data: font, weight: 800, style: "normal" }] : [] },
  );
}
