// lib/theme/admin.ts
import {
  contrast,
  onColor,
  parseColor,
  sameColor,
  scale,
  type Oklch,
} from "./color"
import { NEUTRAL_CHROMA, shift } from "./derive"
import { PRESETS, type PresetId } from "./presets"
import type { AdminThemeConfig } from "./schema"
import { SP_ADMIN_DARK, SP_ADMIN_LIGHT } from "./sp-admin"
import { ADMIN_TOKENS, type AdminToken } from "./tokens"

type AdminTokens = Record<AdminToken, Oklch>
type Mode = "light" | "dark"

// SP_ADMIN (A1) parsed; dark falls back to light for what it leaves out, as
// in admin.css.
const LIGHT = Object.fromEntries(
  ADMIN_TOKENS.map((t) => [t, parseColor(SP_ADMIN_LIGHT[t])!])
) as AdminTokens
const DARK = Object.fromEntries(
  ADMIN_TOKENS.map((t) => [
    t,
    parseColor(SP_ADMIN_DARK[t] ?? SP_ADMIN_LIGHT[t])!,
  ])
) as AdminTokens
const BASE: Record<Mode, AdminTokens> = { light: LIGHT, dark: DARK }

// Semantic colours that must not follow the brand (MK R2). SP keeps its
// contrast-tuned status values (ruling 6).
const FIXED = new Set<AdminToken>([
  "destructive",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "hero-foreground",
  "hero-chip",
  "hero-chip-foreground",
  "promo-foreground",
])

// SP deviation from MK: SP's "neutrals" are navy/slate (c 0.02–0.09 at hue
// ≈ 262), not near-greys, so MK's chroma test alone would rotate body text
// and the navy hero into maroon for a blue primary, and lighten body text
// with a pale one. Only the green family (hue near the SP primary's)
// follows the primary; the navy family keeps SP's values, like FIXED.
const FOLLOW_HUE = 60
const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}
const follows = (value: Oklch, primary: Oklch) =>
  hueDistance(value.h, primary.h) <= FOLLOW_HUE

function anchor(primary: Oklch, mode: Mode): Oklch {
  if (mode === "light") return primary
  // Dark keeps SP's dark primary lightness (#7cc84a) and scales its chroma
  // the way the light primary's chroma moved from #367318.
  const ratio = LIGHT.primary.c > 0 ? primary.c / LIGHT.primary.c : 1
  return {
    l: DARK.primary.l,
    c: Math.min(0.37, DARK.primary.c * ratio),
    h: primary.h,
  }
}

export function buildAdminTokens(
  admin: AdminThemeConfig,
  mode: Mode
): AdminTokens {
  const base = BASE[mode]
  const presetPrimary = parseColor(
    (PRESETS[admin.preset] ?? PRESETS["security-partners"]).admin.primary
  )!
  const primary = (admin.primary && parseColor(admin.primary)) || presetPrimary
  const custom = !sameColor(primary, LIGHT.primary)
  const from = base.primary
  const to = custom ? anchor(primary, mode) : from
  const out = {} as AdminTokens
  for (const t of ADMIN_TOKENS) {
    const value = base[t]
    if (FIXED.has(t)) out[t] = value
    else if (value.c < NEUTRAL_CHROMA) {
      out[t] =
        admin.tint === "none"
          ? { ...value, c: 0, h: 0 }
          : admin.tint === "primary"
            ? { ...value, h: to.h }
            : value
    } else if (!follows(value, from)) out[t] = value
    else out[t] = shift(value, from, to, mode === "light")
  }
  if (custom) {
    out["primary-foreground"] = onColor(out.primary)
    out["sidebar-primary-foreground"] = onColor(out["sidebar-primary"])
  }
  const accent = admin.accent && parseColor(admin.accent)
  if (accent) {
    const ramp = scale(accent)
    const surface = mode === "light" ? accent : ramp[9]!
    const preferred = mode === "light" ? ramp[9]! : ramp[1]!
    const text =
      contrast(preferred, surface) >= 4.5 ? preferred : onColor(surface)
    out.accent = out["sidebar-accent"] = surface
    out["accent-foreground"] = out["sidebar-accent-foreground"] = text
  }
  return out
}

export const ADMIN_DEFAULT: Record<Mode, AdminTokens> = BASE

export const presetAdminColours = (preset: PresetId) => ({
  preset,
  primary: null,
  accent: null,
  tint: "preset" as const,
})
