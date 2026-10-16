"use client"

import { createContext, type ReactNode, useContext } from "react"

import { formatDateTime } from "@/lib/format"

import { relativeTime } from "./format"

/**
 * "Now" for relative times in a list: the moment its data was fetched
 * (TanStack `dataUpdatedAt`), so it moves on with every refetch and server
 * and browser agree.
 */
const NowContext = createContext<number>(Number.NaN)

export function NowProvider({
  now,
  children,
}: {
  now: number
  children: ReactNode
}) {
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>
}

/** "2 hours ago" on one line; the exact date and time on hover. */
export function RelativeTime({
  iso,
  suffix,
  now: explicit,
}: {
  iso: string
  /** Appended after the time, e.g. " · Edith Editor". */
  suffix?: string
  /** Overrides the NowProvider. */
  now?: number
}) {
  const context = useContext(NowContext)
  return (
    <time
      dateTime={iso}
      title={formatDateTime(iso)}
      className="whitespace-nowrap"
    >
      {relativeTime(iso, explicit ?? context)}
      {suffix}
    </time>
  )
}
