// lib/theme/presets.ts
import type { SiteToken } from "./tokens"

export const PRESET_IDS = [
  "security-partners",
  "evergreen",
  "ocean",
  "plum",
  "terracotta",
  "graphite",
] as const
export type PresetId = (typeof PRESET_IDS)[number]

// Today's public palette, verbatim from app/globals.css @theme
// (tests/unit/theme/presets.test.ts keeps them equal). Public colours are
// frozen: the default theme must emit nothing (ruling 4).
export const SP_SITE: Readonly<Record<SiteToken, string>> = {
  "brand-navy": "#0d1b36",
  "brand-blue": "#2751a3",
  "brand-blue-deep": "#03428f",
  "brand-green": "#67bd31",
  "brand-green-dark": "#4e9a22",
  "brand-mint": "#eef6e8",
  "brand-surface": "#f5f7fb",
  "brand-line": "#e3e8f2",
  "brand-ink": "#4a5568",
  "brand-muted": "#718096",
  "brand-placeholder": "#a0aec0",
  "brand-map": "#e8eae6",
}

// Every preset is one shift from the base tables (SP_SITE, SP_ADMIN_*): the
// site's green family follows `site.brand`, the admin follows
// `admin.primary`.
export const PRESETS: Record<
  PresetId,
  {
    label: string
    site: { brand: string }
    admin: { primary: string }
  }
> = {
  "security-partners": {
    label: "Security Partners",
    site: { brand: "#67bd31" },
    admin: { primary: "#367318" },
  },
  evergreen: {
    label: "Evergreen",
    site: { brand: "#1f6b3a" },
    admin: { primary: "#157d38" },
  },
  ocean: {
    label: "Ocean",
    site: { brand: "#2f5f8a" },
    admin: { primary: "#2f5f8a" },
  },
  plum: {
    label: "Plum",
    site: { brand: "#6a3f6b" },
    admin: { primary: "#6a3f6b" },
  },
  terracotta: {
    label: "Terracotta",
    site: { brand: "#8f4a36" },
    admin: { primary: "#9a4a32" },
  },
  graphite: {
    label: "Graphite",
    site: { brand: "#4a4f55" },
    admin: { primary: "#4a4f55" },
  },
}
