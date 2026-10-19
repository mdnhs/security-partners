"use client"

import { useEffect } from "react"

import {
  type AnalyticsWindow,
  classifyClick,
  track,
} from "@/lib/analytics/events"
import { startTracking, type TrackingIds } from "@/lib/analytics/loaders"
import { carriesNewsletterToken } from "@/lib/newsletter/placement"

import { useConsent } from "./consent-provider"

/** Loads the tags the visitor agreed to and reports link clicks (typed events). */
export function TrackingScripts({ ids }: { ids: TrackingIds }) {
  const { choice } = useConsent()
  const { gtmId, ga4Id, metaPixelId } = ids
  useEffect(() => {
    if (choice === "pending" || choice === null) return
    // Page views report the full URL: a newsletter token must not reach a
    // tag. The button POST lands on a token-free page, which loads them.
    if (carriesNewsletterToken(window.location)) return
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
  return null
}
