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
