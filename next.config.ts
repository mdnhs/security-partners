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
  experimental: {
    // forbidden() from requirePermission() renders app/(admin)/admin/forbidden.tsx
    authInterrupts: true,
  },
}

export default nextConfig
