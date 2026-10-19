// lib/theme/sp-admin.ts (isomorphic, no imports)
// The admin palette (spec 2026-10-19-mk-parity §4.2): MK's token structure
// and near-grey neutrals, Security Partners' green, mint and navy. The
// single source for app/(admin)/admin/admin.css (a unit test keeps them
// equal) and, in Phase C, the "security-partners" preset.

/** MK `lib/theme/tokens.ts` ADMIN_TOKENS, in the same order. */
export const ADMIN_TOKEN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "skeleton",
  "hatch",
  "hero-from",
  "hero-to",
  "hero-foreground",
  "hero-chip",
  "hero-chip-foreground",
  "hero-delta",
  "promo-from",
  "promo-to",
  "promo-foreground",
] as const

export type AdminTokenName = (typeof ADMIN_TOKEN_NAMES)[number]

/** `--radius` in rem. */
export const SP_ADMIN_RADIUS = 0.75

/** `html[data-admin]`: every token, lower-case hex. */
export const SP_ADMIN_LIGHT: Readonly<Record<AdminTokenName, string>> = {
  background: "#ffffff",
  foreground: "#0f1726",
  card: "#ffffff",
  "card-foreground": "#0f1726",
  popover: "#ffffff",
  "popover-foreground": "#0f1726",
  primary: "#367318",
  "primary-foreground": "#ffffff",
  secondary: "#eceff3",
  "secondary-foreground": "#0f1726",
  muted: "#eff1f4",
  "muted-foreground": "#5d6575",
  accent: "#eef6e8",
  "accent-foreground": "#2f5f14",
  // Ruling 6: SP's contrast-tuned red (4.5:1 on its own 10 % tint too).
  destructive: "#b91c1c",
  border: "#e3e6eb",
  // Control edges (WCAG 1.4.11): 3:1 on canvas, panels and cards.
  input: "#7b8494",
  ring: "#4e9a22",
  "chart-1": "#2f6a15",
  "chart-2": "#4e9a22",
  "chart-3": "#67bd31",
  "chart-4": "#0d1b36",
  "chart-5": "#a7d98a",
  sidebar: "#f2f3f5",
  "sidebar-foreground": "#0f1726",
  "sidebar-primary": "#367318",
  "sidebar-primary-foreground": "#ffffff",
  "sidebar-accent": "#eef6e8",
  "sidebar-accent-foreground": "#2f5f14",
  "sidebar-border": "#e3e6eb",
  "sidebar-ring": "#4e9a22",
  success: "#15803d",
  "success-soft": "#dcfce7",
  // Ruling 6: 6:1 on --muted (the editor's save pill), 7:1 on white.
  warning: "#92400e",
  "warning-soft": "#fef3c7",
  danger: "#b91c1c",
  "danger-soft": "#fee2e2",
  skeleton: "#e1e4e9",
  // A1 nudge (WCAG 1.4.11): #a7d98a → #709f53, 3:1 on the card.
  hatch: "#709f53",
  "hero-from": "#0d1b36",
  "hero-to": "#1b3566",
  "hero-foreground": "#ffffff",
  "hero-chip": "#ffffff",
  "hero-chip-foreground": "#0d1b36",
  "hero-delta": "#b7e892",
  "promo-from": "#071022",
  "promo-to": "#13284d",
  "promo-foreground": "#ffffff",
}

/**
 * `html[data-admin].dark`: only what dark overrides; the rest (hero and
 * promo surfaces) inherits light. The status colours are overridden: the
 * light ones are under 4.5:1 as text on the dark card and muted panel.
 */
export const SP_ADMIN_DARK: Readonly<Partial<Record<AdminTokenName, string>>> =
  {
    background: "#0b0e13",
    foreground: "#eceff3",
    // A1 nudge: card / popover #1a1f28 → #1c212a (+0.01 L), sidebar #13171e →
    // #151920 (+0.01 L): canvas, panel and card stay distinct (≥ 1.08:1).
    card: "#1c212a",
    "card-foreground": "#eceff3",
    popover: "#1c212a",
    "popover-foreground": "#eceff3",
    primary: "#7cc84a",
    "primary-foreground": "#0a1408",
    secondary: "#1b2029",
    "secondary-foreground": "#eceff3",
    muted: "#1b2029",
    "muted-foreground": "#9aa1ad",
    accent: "#1f3318",
    "accent-foreground": "#cfeab8",
    // Ruling 6: 4.5:1 on its own 20 % tint over the card.
    destructive: "#fca5a5",
    border: "#262c36",
    input: "#6b7382",
    ring: "#7cc84a",
    "chart-1": "#7cc84a",
    "chart-2": "#67bd31",
    "chart-3": "#a7d98a",
    "chart-4": "#c7d3ea",
    "chart-5": "#3f6b25",
    sidebar: "#151920",
    "sidebar-foreground": "#eceff3",
    "sidebar-primary": "#7cc84a",
    "sidebar-primary-foreground": "#0a1408",
    "sidebar-accent": "#1f3318",
    "sidebar-accent-foreground": "#cfeab8",
    "sidebar-border": "#262c36",
    "sidebar-ring": "#7cc84a",
    success: "#4ade80",
    "success-soft": "#12301c",
    warning: "#fbbf24",
    "warning-soft": "#33270c",
    danger: "#f87171",
    "danger-soft": "#3a1414",
    skeleton: "#29303b",
    // A1 nudge (WCAG 1.4.11): #3f6b25 → #4a7731, 3:1 on the card.
    hatch: "#4a7731",
  }

/** Text (and control) on the surface it sits on, with its WCAG minimum. */
export const ADMIN_CONTRAST_PAIRS: readonly [
  text: AdminTokenName,
  surface: AdminTokenName,
  min: 3 | 4.5,
][] = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["muted-foreground", "sidebar", 4.5],
  ["muted-foreground", "card", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["sidebar-foreground", "sidebar", 4.5],
  ["sidebar-primary-foreground", "sidebar-primary", 4.5],
  ["sidebar-accent-foreground", "sidebar-accent", 4.5],
  ["destructive", "card", 4.5],
  ["success", "success-soft", 4.5],
  ["warning", "warning-soft", 4.5],
  ["danger", "danger-soft", 4.5],
  ["hero-foreground", "hero-from", 4.5],
  ["hero-chip-foreground", "hero-chip", 4.5],
  ["promo-foreground", "promo-from", 4.5],
  ["input", "background", 3],
  ["ring", "background", 3],
  ["primary", "background", 3],
]
