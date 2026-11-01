import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Screenshot uploads go through a Server Action; the default 1MB is too
    // small. 10MB file cap (see dashboard/actions.ts) + multipart overhead.
    serverActions: {
      bodySizeLimit: "11mb",
    },
    // The share target can receive several photos in one request.
    proxyClientMaxBodySize: "40mb",
  },
  async headers() {
    return [
      {
        // The service worker must never be served from a stale HTTP cache.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
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
