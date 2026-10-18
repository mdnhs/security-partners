/**
 * One Strict-Transport-Security value for pages (next.config.ts) and /api
 * (Hono secureHeaders). No includeSubDomains: other hosts under the same
 * domain are not ours to force onto https.
 */
export const HSTS = "max-age=31536000"
