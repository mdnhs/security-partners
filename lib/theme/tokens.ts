// lib/theme/tokens.ts
import { ADMIN_TOKEN_NAMES, type AdminTokenName } from "./sp-admin"

// Public colour tokens the theme can override: app/globals.css @theme
// `--color-brand-*`, in declaration order.
export const SITE_TOKENS = [
  "brand-navy",
  "brand-blue",
  "brand-blue-deep",
  "brand-green",
  "brand-green-dark",
  "brand-mint",
  "brand-surface",
  "brand-line",
  "brand-ink",
  "brand-muted",
  "brand-placeholder",
  "brand-map",
] as const
export type SiteToken = (typeof SITE_TOKENS)[number]

// Page backgrounds: "fix automatically" moves the other colour (MK R6).
export const SITE_SURFACES: readonly SiteToken[] = [
  "brand-surface",
  "brand-mint",
  "brand-map",
]

// One list: A1's admin token names (app/(admin)/admin/admin.css, minus
// --radius), in MK order.
export const ADMIN_TOKENS = ADMIN_TOKEN_NAMES
export type AdminToken = AdminTokenName
