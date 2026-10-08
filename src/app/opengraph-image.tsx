import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/ogFont";

export const alt = "Zgradonačelnik.rs — upravnici zgrada, ocene stanara i finansije zgrade";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "Ko upravlja vašom zgradom?";
const SUB = "Licencirani upravnici iz PKS registra · ocene stanara · transparentne finansije";
const BRAND = "Zgradonačelnik.rs";
const CHIPS = ["Besplatno za stanare", "1.500 upravnika", "Srbija"];

export default async function Image() {
  const text = TITLE + SUB + BRAND + CHIPS.join("");
  const [bold, regular] = await Promise.all([loadGoogleFont("Geist", 800, text), loadGoogleFont("Geist", 500, text)]);
  const fonts = [
    ...(bold ? [{ name: "Geist", data: bold, weight: 800 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Geist", data: regular, weight: 500 as const, style: "normal" as const }] : []),
  ];

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
          background: "linear-gradient(150deg, #071829 0%, #0f2744 55%, #0c3020 100%)",
          color: "#ffffff",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>
          Zgradonačelnik<span style={{ color: "#38bdf8" }}>.rs</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{TITLE}</div>
          <div style={{ fontSize: 30, fontWeight: 500, color: "#a9bdd6", lineHeight: 1.35 }}>{SUB}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {CHIPS.map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                fontSize: 22,
                fontWeight: 500,
                padding: "8px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#dbe7f5",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
