// The share image rule of the og-image check (spec §7.1). Isomorphic.

/** At least 1200×630 and a 1.91:1 ratio (± 0.05). */
export function isShareImageSize(w: number, h: number): boolean {
  return w >= 1200 && h >= 630 && Math.abs(w / h - 1.91) <= 0.05
}
