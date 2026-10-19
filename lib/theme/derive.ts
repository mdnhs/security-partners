// lib/theme/derive.ts
import { fit, sameColor, type Oklch } from "./color"

// Below this chroma a token reads as grey and stays put (MK Ruling R2).
export const NEUTRAL_CHROMA = 0.015

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

// Moves `token` the way the anchor moved from `from` to `to`.
export function shift(
  token: Oklch,
  from: Oklch,
  to: Oklch,
  lightness: boolean
): Oklch {
  if (sameColor(from, to) || token.c < NEUTRAL_CHROMA) return token
  const ratio = from.c > 0.02 ? Math.min(2, to.c / from.c) : 1
  return fit({
    l: lightness ? clamp(token.l + (to.l - from.l), 0.04, 0.985) : token.l,
    c: Math.min(0.37, token.c * ratio),
    h: token.h + (to.h - from.h),
  })
}
