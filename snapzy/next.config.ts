import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Supabase serves the signed image URLs and the API. Allow exactly that host.
function supabaseOrigins() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return { https: url.origin, wss: `wss://${url.host}` };
  } catch {
    return { https: "", wss: "" };
  }
}
const supabase = supabaseOrigins();

// Content-Security-Policy. The pages are prerendered, so a per-request nonce
// isn't possible and inline scripts (Next's own, plus the theme boot script)
// need 'unsafe-inline'. The rest still blocks what matters for XSS and
// clickjacking: no foreign scripts, no plugins, no framing, no <base> or form
// hijacking, and network calls only to this site and Supabase.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase.https}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase.https} ${supabase.wss}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Google sign-in is a redirect through Supabase to accounts.google.com.
  `form-action 'self' ${supabase.https} https://accounts.google.com`,
]
  .join("; ")
  .replace(/\s{2,}/g, " ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Older browsers that ignore frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Browsers only honor this over HTTPS, so it is harmless on localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

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
      { source: "/:path*", headers: securityHeaders },
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
  poweredByHeader: false,
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
