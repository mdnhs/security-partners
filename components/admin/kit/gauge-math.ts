// Port of JW admin/components/dashboard/chart-math.ts (gaugeSummary) plus
// its formatShare: integer percentages that never round up to 100%.

export type GaugePart = {
  key: string
  label: string
  value: number
  tone: "solid" | "dark" | "hatched"
}

/**
 * `ratio` is the headline part's share of the total and `headline` its
 * value: the part named `headlineKey`, else the first. Empty → 0, never NaN.
 */
export function gaugeSummary(
  parts: readonly GaugePart[],
  headlineKey?: string
) {
  const clean = parts.map((part) => ({
    ...part,
    value: Number.isFinite(part.value) ? Math.max(0, part.value) : 0,
  }))
  const total = clean.reduce((sum, part) => sum + part.value, 0)
  const headline =
    headlineKey === undefined
      ? clean[0]
      : clean.find((part) => part.key === headlineKey)
  return {
    parts: clean,
    total,
    headline: headline?.value ?? 0,
    ratio: total === 0 ? 0 : (headline?.value ?? 0) / total,
  }
}

const PERCENT = new Intl.NumberFormat("en-IE", {
  style: "percent",
  maximumFractionDigits: 0,
})

export function formatShare(part: number, total: number): string {
  if (!(total > 0)) return "—"
  return PERCENT.format(Math.floor((part * 100) / total) / 100)
}
