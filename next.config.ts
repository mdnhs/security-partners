import type { NextConfig } from "next"

// "standalone" traces only the files the server needs, so the Docker image
// ships a small server.js instead of the full node_modules.
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // forbidden() from requirePermission() renders app/(admin)/admin/forbidden.tsx
    authInterrupts: true,
  },
}

export default nextConfig
