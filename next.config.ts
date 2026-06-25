import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["172.16.10.87", "0.0.0.0"],
};

export default nextConfig;
