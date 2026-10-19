// lib/theme/presets.ts
import { deepFreeze } from "./freeze"
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
export const SP_SITE: Readonly<Record<SiteToken, string>> = deepFreeze({
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
})

// Every preset is one shift from the base tables (SP_SITE, SP_ADMIN_*): the
// site's green family follows `site.brand`, the admin follows
// `admin.primary`. The non-SP site brands are the brief's colours after
// "fix all" (lightened so navy text on the consent button clears 4.5:1),
// baked in as hex so every preset passes SITE_PAIRS unmodified.
export const PRESETS: Readonly<
  Record<
    PresetId,
    {
      readonly label: string
      readonly site: { readonly brand: string }
      readonly admin: { readonly primary: string }
    }
  >
> = deepFreeze({
  "security-partners": {
    label: "Security Partners",
    site: { brand: "#67bd31" },
    admin: { primary: "#367318" },
  },
  evergreen: {
    label: "Evergreen",
    site: { brand: "#49925e" },
    admin: { primary: "#157d38" },
  },
  ocean: {
    label: "Ocean",
    site: { brand: "#5888b6" },
    admin: { primary: "#2f5f8a" },
  },
  plum: {
    label: "Plum",
    site: { brand: "#a475a4" },
    admin: { primary: "#6a3f6b" },
  },
  terracotta: {
    label: "Terracotta",
    site: { brand: "#b9705b" },
    admin: { primary: "#9a4a32" },
  },
  graphite: {
    label: "Graphite",
    site: { brand: "#80858c" },
    admin: { primary: "#4a4f55" },
  },
})
