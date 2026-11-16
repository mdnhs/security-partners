"use client"

import { LazyMotion, MotionConfig, domAnimation } from "motion/react"
import * as m from "motion/react-m"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

/**
 * A thin bar at the very top of the screen that starts on the click of any
 * link to another page of the site and finishes when that page arrives. Links
 * to detail pages do not prefetch (the router once served one service's page
 * for another), so a click waits for the server; this shows at once that the
 * click was taken. Renders nothing otherwise.
 */
const GIVE_UP_MS = 10_000

type Phase = "idle" | "loading" | "done"

/** The page a plain left-click on `link` would go to, or null if none. */
function targetPath(event: MouseEvent, from: string): string | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return null
  const link = (event.target as Element | null)?.closest?.("a")
  if (!link || link.target === "_blank" || link.hasAttribute("download"))
    return null
  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin) return null
  // Same page (an anchor, a different query): nothing to wait for.
  return url.pathname === from ? null : url.pathname
}

export function NavProgress() {
  const pathname = usePathname()
  // The page a click left. Loading while still on it, done once the path
  // changed (derived, so nothing is set from an effect), idle when unset.
  const [left, setLeft] = useState<string | null>(null)
  const phase: Phase =
    left === null ? "idle" : left === pathname ? "loading" : "done"

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (targetPath(event, pathname) !== null) setLeft(pathname)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [pathname])

  // Hide the finished bar; and never leave it running (a click that did not
  // navigate).
  useEffect(() => {
    if (phase === "idle") return
    const timer = window.setTimeout(
      () => setLeft(null),
      phase === "done" ? 450 : GIVE_UP_MS
    )
    return () => window.clearTimeout(timer)
  }, [phase])
  if (phase === "idle") return null
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <m.div
          aria-hidden
          data-nav-progress
          key={phase === "loading" ? "run" : "end"}
          initial={phase === "loading" ? { scaleX: 0, opacity: 1 } : false}
          animate={
            phase === "loading"
              ? { scaleX: 0.85, opacity: 1 }
              : { scaleX: 1, opacity: 0 }
          }
          transition={
            phase === "loading"
              ? { scaleX: { duration: 8, ease: [0.1, 0.7, 0.2, 1] } }
              : {
                  scaleX: { duration: 0.2 },
                  opacity: { duration: 0.35, delay: 0.15 },
                }
          }
          className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-brand-green"
        />
      </LazyMotion>
    </MotionConfig>
  )
}
