import type { NextConfig } from "next";

import { parseServerEnv } from "./src/lib/env/schema";

// Fail `next dev` and `next build` at startup when a variable is missing,
// instead of on the first request that needs it.
parseServerEnv(process.env);

// A nonce-based script CSP lands with the first interactive pages; these
// directives don't touch scripts, so they are safe to ship now.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Nothing is indexed by default (FR-8.4). Wedding websites under /site are
// left out: each page sets its own robots tag from the couple's choice.
const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers() {
    return Promise.resolve([
      { source: "/:path*", headers: securityHeaders },
      { source: "/:path((?!site/).*)", headers: noIndex },
      // A guest's RSVP link carries their token: never send it on as a Referer
      // (to maps, calendars or WhatsApp). Later entries win for the same header.
      { source: "/r/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ]);
  },
};

export default nextConfig;
