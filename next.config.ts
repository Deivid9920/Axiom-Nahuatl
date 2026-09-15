import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // SECURITY: Don't ignore build errors — catch type issues before production
  typescript: {
    ignoreBuildErrors: false,
  },
  // SECURITY: Enable React strict mode for development safety checks
  reactStrictMode: true,
  // SECURITY: Powered-by header removal
  poweredByHeader: false,
  // SECURITY: Compress responses
  compress: true,
};

export default nextConfig;
