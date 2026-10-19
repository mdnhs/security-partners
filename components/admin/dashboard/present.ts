import type { PillBarDatum } from "@/components/admin/kit/pill-bar-chart"

const HOUR = new Intl.DateTimeFormat("en-IE", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Dublin",
})
// Trend dates are Irish calendar dates ("2026-10-10"): format them as UTC.
const DAY_MONTH = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

/** "Good morning" / "Good afternoon" / "Good evening" by the clock in Ireland. */
export function greetingFor(
  date: Date
): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(HOUR.format(date))
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export const firstName = (name: string) =>
  name.trim().split(/\s+/)[0] || "there"

/** Daily counts (oldest first) → 7-day pills ending today, newest last. */
export function weeklyBuckets(
  trend: readonly { date: string; count: number }[]
): PillBarDatum[] {
  const weeks: PillBarDatum[] = []
  for (let end = trend.length; end > 0; end -= 7) {
    const days = trend.slice(Math.max(0, end - 7), end)
    const start = days[0]!.date
    weeks.unshift({
      key: start,
      label: DAY_MONTH.format(new Date(`${start}T00:00:00Z`)),
      current: days.reduce((sum, day) => sum + day.count, 0),
      // One series until the week-vs-week data lands (D3.5).
      previous: null,
    })
  }
  return weeks
}
