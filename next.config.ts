import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["172.16.10.87", "0.0.0.0"],
  // Serve the standalone public/product-map.html at the clean URL.
  async rewrites() {
    return [{ source: "/product-map", destination: "/product-map.html" }];
  },
};

export default nextConfig;
