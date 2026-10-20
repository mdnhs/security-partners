import type { NextConfig } from "next"

import { ADMIN_LEGACY_REDIRECTS } from "./lib/admin/legacy-redirects"
import { HSTS } from "./lib/security-headers"
import { HTML_LIMITED_BOTS } from "./lib/seo/blocking-metadata"

/**
 * CSP directives that restrict nothing the site loads: no `<base>` hijack,
 * no plugins, framing as allowed below. Deliberately no script-src /
 * connect-src / img-src / frame-src: Cache Components serve static shells
 * whose inline bootstrap cannot carry a per-request nonce (Next docs
 * "content-security-policy": nonces need fully dynamic rendering, PPR is
 * incompatible), and Marketing ▸ Tracking / Custom code, Turnstile
 * (challenges.cloudflare.com) and the AI panel need inline loaders and
 * third-party hosts — docs/runbook.md lists what a stricter policy must allow.
 */
const cspWith = (frameAncestors: string) =>
  `base-uri 'self'; object-src 'none'; frame-ancestors ${frameAncestors}`

/** Spec §13 hardening headers for pages (Hono's secureHeaders() covers /api). */
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The admin's live preview frames the public site (same origin).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Ignored by browsers over http (local, E2E); Traefik serves https.
  { key: "Strict-Transport-Security", value: HSTS },
  { key: "Content-Security-Policy", value: cspWith("'self'") },
]

// "standalone" traces only the files the server needs, so the Docker image
// ships a small server.js instead of the full node_modules.
const nextConfig: NextConfig = {
  output: "standalone",
  // The share-card route reads its fonts from disk (standalone trace).
  outputFileTracingIncludes: { "/og/**": ["./assets/fonts/**"] },
  poweredByHeader: false,
  // Cache Components: routes are dynamic unless data is cached with
  // 'use cache' (server/modules/*/queries.ts). Public pages read the DB
  // inside <Suspense> after connection(), so `next build` needs no DB.
  cacheComponents: true,
  // Blocking metadata for every public page document: title, description,
  // canonical and Open Graph tags are in <head>, never streamed into <body>.
  // Lighthouse 13 no longer identifies itself as a bot and the SEO gate
  // (Lighthouse SEO 100) needs the description in <head>. Only requests
  // proxy.ts marks match: `/.*/` also caught RSC navigations, which broke
  // client navigation between params of one route (lib/seo/blocking-metadata).
  htmlLimitedBots: HTML_LIMITED_BOTS,
  experimental: {
    // forbidden() from requirePermission() renders app/(admin)/admin/forbidden.tsx
    authInterrupts: true,
  },
  // Pre-MK admin URLs → their MK homes (308, query kept). Sources are all
  // under /admin/, so no public URL can match.
  async redirects() {
    return [...ADMIN_LEGACY_REDIRECTS]
  },
  async headers() {
    return [
      { source: "/((?!api/).*)", headers: SECURITY_HEADERS },
      // Newsletter confirm/unsubscribe pages carry a token in the URL: never
      // stored by a cache, sent on as a Referer, or indexed. Next only sets
      // its own Cache-Control when none is set (send-payload.js).
      {
        source: "/newsletter/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      // The admin is never framed (later rules override the same key).
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: cspWith("'none'") },
        ],
      },
    ]
  },
}

export default nextConfig
