"use client"

import { useEffect, useState } from "react"

import {
  type AnalyticsWindow,
  classifyClick,
  track,
} from "@/lib/analytics/events"
import { startTracking, type TrackingIds } from "@/lib/analytics/loaders"
import {
  carriesNewsletterToken,
  NEWSLETTER_TOKEN_STRIPPED,
} from "@/lib/newsletter/placement"

import { useConsent } from "./consent-provider"

/** Loads the tags the visitor agreed to and reports link clicks (typed events). */
export function TrackingScripts({ ids }: { ids: TrackingIds }) {
  const { choice } = useConsent()
  const { gtmId, ga4Id, metaPixelId } = ids
  // Bumped when a newsletter token page strips ?token from the URL, so the
  // check below runs again on the now token-free URL.
  const [urlCheck, setUrlCheck] = useState(0)
  useEffect(() => {
    const recheck = () => setUrlCheck((n) => n + 1)
    window.addEventListener(NEWSLETTER_TOKEN_STRIPPED, recheck)
    return () => window.removeEventListener(NEWSLETTER_TOKEN_STRIPPED, recheck)
  }, [])
  useEffect(() => {
    if (choice === "pending" || choice === null) return
    // Page views report the full URL: a newsletter token must not reach a
    // tag. The token page strips it after hydration (StripNewsletterToken),
    // which re-runs this check and loads the tags on the clean URL.
    if (carriesNewsletterToken(window.location)) return
    startTracking({ gtmId, ga4Id, metaPixelId }, choice, {
      win: window as AnalyticsWindow,
      doc: document,
    })
  }, [choice, gtmId, ga4Id, metaPixelId, urlCheck])
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
