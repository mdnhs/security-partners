"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { track } from "@/lib/analytics/events"

/** How long to wait for the new page's `<title>` before sending anyway. */
export const TITLE_WAIT_MS = 1000

/**
 * Reports client-side navigations as `page_view_virtual`. The first page is
 * skipped: the tags count it themselves when they load. `track` checks
 * consent, so nothing is sent until the visitor has agreed to analytics.
 *
 * The new page's `<title>` can stream in after the path changes, so when
 * the title still reads as the previous page's, it waits for a `<head>`
 * change (or TITLE_WAIT_MS, for pages sharing a title), then one frame.
 */
export function RouteTracker(): null {
  const pathname = usePathname()
  // The last path seen, not a "first render" flag: StrictMode mounts twice
  // and that must not count as a page change.
  const seen = useRef(pathname)
  // The title of the last page counted (the landing page's at first).
  const lastTitle = useRef<string | null>(null)
  useEffect(() => {
    lastTitle.current ??= document.title
  }, [])
  useEffect(() => {
    if (seen.current === pathname) return
    seen.current = pathname
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let observer: MutationObserver | undefined
    const send = () => {
      observer?.disconnect()
      clearTimeout(timer)
      frame = requestAnimationFrame(() => {
        lastTitle.current = document.title
        track({
          event: "page_view_virtual",
          page_path: pathname,
          page_title: document.title,
        })
      })
    }
    if (document.title !== lastTitle.current) send()
    else {
      observer = new MutationObserver(() => {
        if (document.title !== lastTitle.current) send()
      })
      observer.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
      })
      timer = setTimeout(send, TITLE_WAIT_MS)
    }
    return () => {
      observer?.disconnect()
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [pathname])
  return null
}
