const NUMBER = new Intl.NumberFormat("en-IE")
const PERCENT = new Intl.NumberFormat("en-IE", {
  style: "percent",
  maximumFractionDigits: 0,
})
const CHANGE = new Intl.NumberFormat("en-IE", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})
const RELATIVE = new Intl.RelativeTimeFormat("en-IE", { numeric: "auto" })

export const formatNumber = (n: number) => NUMBER.format(n)
export const formatPercent = (ratio: number) => PERCENT.format(ratio)

export type Delta = { label: string; direction: "up" | "down" | "flat" }

/** A KPI caption's "+3.4%"; without a baseline there is no honest percentage. */
export function formatDelta(current: number, previous: number): Delta | null {
  if (previous === 0) {
    return current === 0 ? { label: "No change", direction: "flat" } : null
  }
  const change = (current - previous) / previous
  if (Math.abs(change) < 0.0005)
    return { label: "No change", direction: "flat" }
  return { label: CHANGE.format(change), direction: change > 0 ? "up" : "down" }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
]

/** "5 minutes ago"; `now` is passed in so server and browser agree. */
export function relativeTime(iso: string, now: number): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  if (Math.abs(seconds) < 45) return "just now"
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return RELATIVE.format(Math.round(seconds / size), unit)
    }
  }
  return RELATIVE.format(Math.round(seconds / 60), "minute")
}

/** Index of the largest value (first on ties); -1 for an empty list. */
export function peakIndex(values: readonly number[]): number {
  let best = -1
  values.forEach((value, index) => {
    if (best === -1 || value > values[best]!) best = index
  })
  return best
}

/** Up to two initials for avatar fallbacks; "?" without a name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.length
    ? parts.map((part) => part[0]!.toUpperCase()).join("")
    : "?"
}
