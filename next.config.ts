import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Registar iz repoa mora biti u serverless bundle-u za uvoz na Vercelu.
  outputFileTracingIncludes: {
    "/api/admin/registry-import": ["./docs/solidus.csv"],
  },
};

export default nextConfig;
