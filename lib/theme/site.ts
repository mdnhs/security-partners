// lib/theme/site.ts
import { parseColor, type Oklch } from "./color"
import { shift } from "./derive"
import { PRESETS, SP_SITE, type PresetId } from "./presets"
import type { SiteThemeConfig } from "./schema"
import { SITE_TOKENS, type SiteToken } from "./tokens"

type SiteTokens = Record<SiteToken, Oklch>

const table = (hex: Readonly<Record<SiteToken, string>>) =>
  Object.fromEntries(
    SITE_TOKENS.map((t) => [t, parseColor(hex[t])!])
  ) as SiteTokens

const BASE = table(SP_SITE)

// The brand drives only the green family; navy, blue, ink and the neutrals
// change only through locked `site.tokens`.
export const BRAND_FAMILY: readonly SiteToken[] = [
  "brand-green",
  "brand-green-dark",
  "brand-mint",
]

function derived(from: SiteTokens, brand: Oklch): SiteTokens {
  const anchor = from["brand-green"]
  return Object.fromEntries(
    SITE_TOKENS.map((t) => [
      t,
      t === "brand-green"
        ? brand
        : BRAND_FAMILY.includes(t)
          ? shift(from[t], anchor, brand, true)
          : from[t],
    ])
  ) as SiteTokens
}

const PRESET_TABLES = Object.fromEntries(
  (Object.keys(PRESETS) as PresetId[]).map((id) => [
    id,
    derived(BASE, parseColor(PRESETS[id].site.brand)!),
  ])
) as Record<PresetId, SiteTokens>

// Stored values are canonical; a value that somehow fails to parse falls
// back to the preset's, so rendering never throws.
export function resolveSiteTokens(site: SiteThemeConfig): SiteTokens {
  const preset =
    PRESET_TABLES[site.preset] ?? PRESET_TABLES["security-partners"]
  const brand = (site.brand && parseColor(site.brand)) || preset["brand-green"]
  const out = derived(preset, brand)
  for (const t of SITE_TOKENS) {
    const locked = site.tokens[t]
    const color = locked ? parseColor(locked) : null
    if (color) out[t] = color
  }
  return out
}

export const SITE_DEFAULT: SiteTokens = PRESET_TABLES["security-partners"]

export const presetSiteTheme = (preset: PresetId): SiteThemeConfig => ({
  preset,
  brand: null,
  tokens: {},
})
