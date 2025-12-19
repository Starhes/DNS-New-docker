import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow cross-origin requests from your custom domain in development
  allowedDevOrigins: [
    "dns.unix.us.ci",
    "http://dns.unix.us.ci",
    "https://dns.unix.us.ci",
  ],
};

export default nextConfig;
