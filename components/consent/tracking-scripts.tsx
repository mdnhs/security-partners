"use client"

import { useEffect } from "react"

import {
  type AnalyticsWindow,
  classifyClick,
  track,
} from "@/lib/analytics/events"
import { startTracking, type TrackingIds } from "@/lib/analytics/loaders"

import { useConsent } from "./consent-provider"
import { RouteTracker } from "./route-tracker"

/**
 * Loads the tags the visitor agreed to and reports link clicks and
 * client-side page changes (typed events).
 */
export function TrackingScripts({ ids }: { ids: TrackingIds }) {
  const { choice } = useConsent()
  const { gtmId, ga4Id, metaPixelId } = ids
  useEffect(() => {
    if (choice === "pending" || choice === null) return
    startTracking({ gtmId, ga4Id, metaPixelId }, choice, {
      win: window as AnalyticsWindow,
      doc: document,
    })
  }, [choice, gtmId, ga4Id, metaPixelId])
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null
      const anchor = target?.closest?.("a[href]")
      if (!anchor) return
      const tracked = classifyClick(
        anchor.getAttribute("href") ?? "",
        anchor.textContent ?? ""
      )
      if (tracked) track(tracked)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])
  return <RouteTracker />
}
