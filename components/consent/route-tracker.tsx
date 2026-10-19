"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { track } from "@/lib/analytics/events"

/**
 * Reports client-side navigations as `page_view_virtual`. The first page is
 * skipped: the tags count it themselves when they load. The push waits a
 * frame so `document.title` is the new page's. `track` checks consent, so
 * nothing is sent until the visitor has agreed to analytics.
 */
export function RouteTracker(): null {
  const pathname = usePathname()
  // The last path seen, not a "first render" flag: StrictMode mounts twice
  // and that must not count as a page change.
  const seen = useRef(pathname)
  useEffect(() => {
    if (seen.current === pathname) return
    seen.current = pathname
    const frame = requestAnimationFrame(() =>
      track({
        event: "page_view_virtual",
        page_path: pathname,
        page_title: document.title,
      })
    )
    return () => cancelAnimationFrame(frame)
  }, [pathname])
  return null
}
