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
 * The instant whose wall clock in `tz` reads `wall` (a UTC timestamp
 * standing for the local date and time). Irish clocks change at 01:00 UTC,
 * so midnight always exists and is unique; a time in the skipped spring
 * hour lands an hour later, one in the repeated autumn hour on its first
 * occurrence.
 */
function localInstant(wall: number, tz: string): number {
  const at = wall - offsetAt(wall, tz)
  return wall - offsetAt(at, tz)
}

function localMidnight(utcDay: number, tz: string): Date {
  return new Date(localInstant(utcDay, tz))
}

const isoOf = (utcDay: number) => new Date(utcDay).toISOString().slice(0, 10)

/** Today's date in `tz` as a UTC-midnight timestamp, and the wall time into it. */
function localDay(now: Date, tz: string) {
  const p = wallClock(now, tz)
  const day = Date.UTC(p.year, p.month - 1, p.day)
  const intoDay =
    ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + now.getUTCMilliseconds()
  return { day, intoDay }
}

/** Local midnight (`tz`) at the start of calendar day `day` ("2026-10-26"). */
export function startOfDay(
  day: string,
  tz: "Europe/Dublin" = "Europe/Dublin"
): Date {
  const [y, m, d] = day.split("-").map(Number)
  return localMidnight(Date.UTC(y!, m! - 1, d!), tz)
}

/**
 * The instant on calendar day `day` whose wall clock (`tz`) reads the same
 * time as `now`: the cut-off that makes a partial period comparable with
 * an earlier one ("this time last week", the 30-day KPI's baseline).
 * Never later than the next day's midnight.
 */
export function sameTimeOn(
  now: Date,
  day: string,
  tz: "Europe/Dublin" = "Europe/Dublin"
): Date {
  const [y, m, d] = day.split("-").map(Number)
  const utcDay = Date.UTC(y!, m! - 1, d!)
  const at = localInstant(utcDay + localDay(now, tz).intoDay, tz)
  return new Date(Math.min(at, localMidnight(utcDay + DAY, tz).getTime()))
}

/**
 * This week (Monday → Sunday, Irish calendar days) and the week before,
 * as instants for querying and as day keys for bucketing. `end` is the
 * next Monday 00:00 (exclusive); `start` doubles as the previous week's end.
 * `previousCut` is the same weekday and wall-clock time last week: last
 * week "so far", comparable with this week so far.
 */
export function weekWindow(
  now: Date,
  tz: "Europe/Dublin" = "Europe/Dublin"
): {
  start: Date
  end: Date
  previousStart: Date
  previousCut: Date
  days: WeekDay[]
  previousDays: WeekDay[]
} {
  const { day: todayUtc } = localDay(now, tz)
  // getUTCDay: 0 = Sunday … 6 = Saturday; Monday-based index 0 … 6.
  const sinceMonday = (new Date(todayUtc).getUTCDay() + 6) % 7
  const monday = todayUtc - sinceMonday * DAY
  const daysFrom = (first: number): WeekDay[] =>
    LABELS.map((label, i) => ({ key: isoOf(first + i * DAY), label }))
  const start = localMidnight(monday, tz)
  return {
    start,
    end: localMidnight(monday + 7 * DAY, tz),
    previousStart: localMidnight(monday - 7 * DAY, tz),
    previousCut: sameTimeOn(now, isoOf(todayUtc - 7 * DAY), tz),
    days: daysFrom(monday),
    previousDays: daysFrom(monday - 7 * DAY),
  }
}
