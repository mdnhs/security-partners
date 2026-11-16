"use client"

import { useEffect } from "react"

/**
 * The navbar and footer live in the layout, each in its own Suspense
 * boundary beside the page, so on a first load the page can hydrate before
 * they do. A page's motion (HomeMotion) reaches into both (the header's
 * scroll bar, the footer's story): started before they hydrate, it rewrites
 * their server HTML (inline styles, SplitText's aria-labels) and React
 * throws a hydration mismatch. So motion waits for them with
 * whenChromeReady; each marks itself with <ChromeReady /> once hydrated.
 */
type Part = "header" | "footer"

const SELECTOR: Record<Part, string> = {
  header: "[data-site-header]",
  footer: "[data-site-footer]",
}
// Never wait forever: a chrome slot that fails to hydrate must not leave
// the page without its motion.
const GIVE_UP_MS = 4000

const hydrated = new Set<Part>()
const waiting = new Set<() => void>()

const pending = () =>
  (Object.keys(SELECTOR) as Part[]).some(
    (part) => !hydrated.has(part) && document.querySelector(SELECTOR[part])
  )

/** Runs `run` once the navbar and footer in the DOM have hydrated (now, if so). */
export function whenChromeReady(run: () => void): () => void {
  if (!pending()) {
    run()
    return () => {}
  }
  let done = false
  const go = () => {
    if (done) return
    done = true
    waiting.delete(check)
    window.clearTimeout(timer)
    run()
  }
  const check = () => {
    if (!pending()) go()
  }
  const timer = window.setTimeout(go, GIVE_UP_MS)
  waiting.add(check)
  return () => {
    done = true
    waiting.delete(check)
    window.clearTimeout(timer)
  }
}

/** Renders nothing; mounting means the part around it has hydrated. */
export function ChromeReady({ part }: { part: Part }) {
  useEffect(() => {
    hydrated.add(part)
    for (const check of [...waiting]) check()
  }, [part])
  return null
}
