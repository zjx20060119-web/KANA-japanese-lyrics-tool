import type { NextConfig } from "next";

const isOfflineExport = process.env.OFFLINE_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(isOfflineExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
  /* config options here */
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "10.198.226.167",
    "10.123.34.220",
    "100.106.62.63",
    "node.tail3695e6.ts.net",
  ],
  cacheComponents: !isOfflineExport,
  devIndicators: false,
  partialPrefetching: !isOfflineExport,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
