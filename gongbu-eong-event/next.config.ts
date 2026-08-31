import type { NextConfig } from "next";

const eventAssetPrefix = process.env.EVENT_ASSET_PREFIX?.replace(/\/$/, "");
const shouldUseAssetPrefix = process.env.NODE_ENV === "production" && eventAssetPrefix;

const nextConfig: NextConfig = {
  assetPrefix: shouldUseAssetPrefix ? eventAssetPrefix : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
