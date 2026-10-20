// The dashboard's "Enquiries this week" window (MK parity D3.5). Pure and
// isomorphic: weeks run Monday 00:00 to Sunday 23:59 on the clock in
// Ireland, so a week can be 167 or 169 hours long around a DST change.

export type WeekDay = {
  /** Irish calendar date, yyyy-MM-dd. */
  key: string
  /** Short weekday name, "Mon" … "Sun". */
  label: string
}

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const DAY = 86_400_000

const formatters = new Map<string, Intl.DateTimeFormat>()

/** Wall-clock parts of `at` in `tz` (en-US: numeric parts, h23). */
function wallClock(at: Date, tz: string) {
  let format = formatters.get(tz)
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
    formatters.set(tz, format)
  }
  const parts = Object.fromEntries(
    format.formatToParts(at).map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>
  return parts as {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
  }
}

/** The zone's offset from UTC at `at`, in milliseconds. */
function offsetAt(at: number, tz: string): number {
  const p = wallClock(new Date(at), tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(at / 1000) * 1000
}

/**
 * The instant of local midnight on calendar day `utcDay` (a UTC-midnight
 * timestamp standing for the date). Irish clocks change at 01:00 UTC, so
 * midnight always exists and is unique.
 */
function localMidnight(utcDay: number, tz: string): Date {
  let at = utcDay - offsetAt(utcDay, tz)
  at = utcDay - offsetAt(at, tz)
  return new Date(at)
}

const isoOf = (utcDay: number) => new Date(utcDay).toISOString().slice(0, 10)

/**
 * This week (Monday → Sunday, Irish calendar days) and the week before,
 * as instants for querying and as day keys for bucketing. `end` is the
 * next Monday 00:00 (exclusive); `start` doubles as the previous week's end.
 */
export function weekWindow(
  now: Date,
  tz: "Europe/Dublin" = "Europe/Dublin"
): {
  start: Date
  end: Date
  previousStart: Date
  days: WeekDay[]
  previousDays: WeekDay[]
} {
  const today = wallClock(now, tz)
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day)
  // getUTCDay: 0 = Sunday … 6 = Saturday; Monday-based index 0 … 6.
  const sinceMonday = (new Date(todayUtc).getUTCDay() + 6) % 7
  const monday = todayUtc - sinceMonday * DAY
  const daysFrom = (first: number): WeekDay[] =>
    LABELS.map((label, i) => ({ key: isoOf(first + i * DAY), label }))
  return {
    start: localMidnight(monday, tz),
    end: localMidnight(monday + 7 * DAY, tz),
    previousStart: localMidnight(monday - 7 * DAY, tz),
    days: daysFrom(monday),
    previousDays: daysFrom(monday - 7 * DAY),
  }
}
