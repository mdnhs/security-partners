import { useSyncExternalStore } from "react"

import { SITE_LOCALE, SITE_TIME_ZONE } from "@/lib/format"

// Irish time, as the rest of the admin (lib/format.ts).
const TIME = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: SITE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
const DAY = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: SITE_TIME_ZONE,
  day: "numeric",
  month: "short",
})
const YMD = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** A message's time: "HH:mm" today, otherwise "d MMM, HH:mm" (JW present.ts). */
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const time = TIME.format(date)
  return YMD.format(date) === YMD.format(now)
    ? time
    : `${DAY.format(date)}, ${time}`
}

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

/** False while the tab is in the background. */
export function useTabVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !document.hidden,
    () => true
  )
}
