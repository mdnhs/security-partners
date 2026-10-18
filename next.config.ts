import type { NextConfig } from "next"

// "standalone" traces only the files the server needs, so the Docker image
// ships a small server.js instead of the full node_modules.
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Cache Components: routes are dynamic unless data is cached with
  // 'use cache' (server/modules/*/queries.ts). Public pages read the DB
  // inside <Suspense> after connection(), so `next build` needs no DB.
  cacheComponents: true,
  // Blocking metadata for every client: title, description, canonical and
  // Open Graph tags are in <head>, never streamed into <body>. Lighthouse 13
  // no longer identifies itself as a bot, and the SEO gate (Lighthouse SEO
  // 100) needs the description in <head> (phase-08 correction).
  htmlLimitedBots: /.*/,
  experimental: {
    // forbidden() from requirePermission() renders app/(admin)/admin/forbidden.tsx
    authInterrupts: true,
  },
}

export default nextConfig
