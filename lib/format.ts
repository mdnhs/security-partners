// Display formatting for the admin (global constraint: Europe/Dublin, en-IE).
export const SITE_TIME_ZONE = "Europe/Dublin"
export const SITE_LOCALE = "en-IE"

const dateTime = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: SITE_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
})

/** "16 Oct 2026, 14:05" in Irish time, from an ISO string or Date. */
export function formatDateTime(value: string | Date): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value)
}

/** Short device label from a user agent ("Chrome on macOS"); "Unknown device" if empty. */
export function describeUserAgent(
  userAgent: string | null | undefined
): string {
  if (!userAgent) return "Unknown device"
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : null
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? "Unknown device"
}

// Article dates. Intl's en-IE short month for September is "Sept", but the
// site prints "20 Sep 2026", so month names come from a fixed list.
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const calendarDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Calendar date in Irish time as "2026-09-20" (for <time dateTime>). */
export function isoDate(value: Date): string {
  const parts = Object.fromEntries(
    calendarDate.formatToParts(value).map((p) => [p.type, p.value])
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** "20 Sep 2026" in Irish time (article cards and headers). */
export function formatPostDate(value: Date): string {
  const [year, month, day] = isoDate(value).split("-")
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`
}

// Schedule dialog: <input type="datetime-local"> holds Irish wall-clock time.
const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: SITE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function wallClockParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    wallClock.formatToParts(date).map((p) => [p.type, p.value])
  )
}

/** Minutes Irish time is ahead of UTC at `date` (0 in winter, 60 in summer). */
function dublinOffsetMinutes(date: Date): number {
  const p = wallClockParts(date)
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  )
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000)
}

/** "2026-07-01T10:00": the Irish wall-clock time of an instant (datetime-local value). */
export function toDublinInput(date: Date): string {
  const p = wallClockParts(date)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * The instant an Irish wall-clock time denotes; null when malformed. A time
 * skipped by the spring change (01:xx on the last Sunday of March) moves
 * one hour later; a time repeated in autumn takes the later (GMT) instant.
 */
export function fromDublinInput(value: string): Date | null {
  const match = LOCAL_INPUT.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  )
    return null
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  const first = naive - dublinOffsetMinutes(new Date(naive)) * 60_000
  return new Date(naive - dublinOffsetMinutes(new Date(first)) * 60_000)
}
