import "server-only"

import { isoDate } from "@/lib/format"

const DAY = 86_400_000
const DEFAULT_DAYS = 90

/**
 * The last `days` calendar dates (Europe/Dublin), oldest first, ending
 * today. Pure, in its own module so the AI tools can use it without
 * importing the dashboard service at load time (C8 review M6).
 */
export function trendDays(now: Date, days = DEFAULT_DAYS): string[] {
  const [y, m, d] = isoDate(now).split("-").map(Number)
  // Noon UTC: one calendar day per step, whatever the DST offset.
  const todayNoon = Date.UTC(y, m - 1, d, 12)
  return Array.from({ length: days }, (_, i) =>
    new Date(todayNoon - (days - 1 - i) * DAY).toISOString().slice(0, 10)
  )
}
