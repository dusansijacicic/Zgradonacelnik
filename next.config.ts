import type { NextConfig } from "next";

const PRIVATE = ["/dashboard/:path*", "/manager/:path*", "/admin/:path*", "/zgrade/:path*", "/onboarding", "/login", "/auth/:path*", "/odjava-poziva"];

const nextConfig: NextConfig = {
  // Registar iz repoa mora biti u serverless bundle-u za uvoz na Vercelu.
  outputFileTracingIncludes: {
    "/api/admin/registry-import": ["./docs/solidus.csv"],
  },
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
  },
  experimental: {
    // Manji JS: uvozi samo korišćene delove ovih paketa.
    optimizePackageImports: ["date-fns", "zod"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      // Privatne stranice nikad u Google indeks (pored robots.txt).
      ...PRIVATE.map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] })),
      {
        source: "/zgradonacelnik_logo.jpeg",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
