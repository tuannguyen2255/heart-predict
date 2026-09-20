import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    // Set at build time after publishing .next/static to the CDN.
    assetPrefix: process.env.NODE_ENV === "production" ? process.env.ASSET_PREFIX || undefined : undefined,
};

export default nextConfig;
