// lib/theme/color.ts
import { converter, formatHex, parse, toGamut, wcagContrast } from "culori"

// spec 2026-10-19-mk-parity §6 (ported from MK lib/theme/color.ts). Isomorphic and pure: the server builds CSS from
// these numbers, the admin previews with them.
export type Oklch = { l: number; c: number; h: number }

const toOklch = converter("oklch")
// toGamut(dest, mode): a function that maps any colour into sRGB, reducing
// chroma in OKLCH, and returns it in rgb mode.
const intoRgb = toGamut("rgb", "oklch")

// Ruling R1: only these two forms reach culori. Named colours, var(),
// rgb() and anything with a ";" or "<" are refused here.
const HEX_INPUT = /^#[0-9a-f]{6}$/i
const OKLCH_INPUT =
  /^oklch\(\s*\d*\.?\d+%?\s+\d*\.?\d+\s+\d*\.?\d+(?:deg)?\s*\)$/i

export const WHITE: Readonly<Oklch> = Object.freeze({ l: 1, c: 0, h: 0 })
export const BLACK: Readonly<Oklch> = Object.freeze({ l: 0, c: 0, h: 0 })

const round = (value: number, places: number) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function normalise(color: { l: number; c?: number; h?: number }): Oklch {
  const l = round(Math.min(1, Math.max(0, color.l)), 4)
  const c = round(Math.max(0, color.c ?? 0), 4)
  const hue = Number.isFinite(color.h) ? (color.h as number) : 0
  const h = round(((hue % 360) + 360) % 360, 2)
  if (c < 0.0005) return { l, c: 0, h: 0 }
  return { l, c, h: h === 360 ? 0 : h }
}

const culoriOklch = (color: Oklch) => ({ mode: "oklch" as const, ...color })

export function fit(color: Oklch): Oklch {
  return normalise(toOklch(intoRgb(culoriOklch(color))))
}

export function parseColor(input: string): Oklch | null {
  const text = input.trim()
  if (text.length > 64) return null
  if (!HEX_INPUT.test(text) && !OKLCH_INPUT.test(text)) return null
  const parsed = parse(text.toLowerCase())
  if (!parsed) return null
  const mapped = toOklch(intoRgb(parsed))
  if (!mapped || !Number.isFinite(mapped.l)) return null
  return normalise(mapped)
}

// Re-serialised from numbers, never from the stored string.
export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${round(l, 4)} ${round(c, 4)} ${round(h, 2)})`
}

export function toHex(color: Oklch): string {
  return formatHex(intoRgb(culoriOklch(color)))
}

export function contrast(a: Oklch, b: Oklch): number {
  return wcagContrast(intoRgb(culoriOklch(a)), intoRgb(culoriOklch(b)))
}

export const sameColor = (a: Oklch, b: Oklch) =>
  a.l === b.l && a.c === b.c && a.h === b.h

export const SCALE_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const
const LIGHTNESS = [
  0.971, 0.936, 0.885, 0.808, 0.712, 0.614, 0.523, 0.443, 0.37, 0.295, 0.215,
]
// Chroma eases off towards both ends so the palest and darkest steps stay
// inside sRGB without clipping to grey.
const CHROMA = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 0.95, 0.85, 0.72, 0.58, 0.45]

export function scale(base: Oklch): Oklch[] {
  return LIGHTNESS.map((l, i) => fit({ l, c: base.c * CHROMA[i]!, h: base.h }))
}

// A tinted near-black or white, whichever reads better; pure black or white
// as the fallback, which always clears 4.5:1 on some side.
export function onColor(bg: Oklch, min = 4.5): Oklch {
  const dark = fit({ l: 0.2, c: Math.min(bg.c, 0.03), h: bg.h })
  const best = contrast(WHITE, bg) >= contrast(dark, bg) ? WHITE : dark
  if (contrast(best, bg) >= min) return best
  return contrast(WHITE, bg) >= contrast(BLACK, bg) ? WHITE : BLACK
}

// "Fix automatically" (§10.1): step the lightness of `moving` away from
// `fixed` until the pair reaches `min`.
export function nudge(moving: Oklch, fixed: Oklch, min: number): Oklch | null {
  const darker = contrast(BLACK, fixed) >= contrast(WHITE, fixed)
  for (let i = 0; i <= 100; i++) {
    const l = darker ? moving.l - i * 0.01 : moving.l + i * 0.01
    if (l < 0 || l > 1) break
    const candidate = fit({ ...moving, l })
    if (contrast(candidate, fixed) >= min) return candidate
  }
  return null
}
