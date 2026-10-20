"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { NAVIGATE_EVENT } from "@/lib/analytics/snippets"

/**
 * Dispatches "sp:navigate" after each client-side navigation (a pathname
 * change), never on the first render: the custom code loader re-checks
 * its snippets' routes then (components/consent/custom-code.tsx). The site
 * layout persists across next/link navigation, so this is the only signal.
 * Renders nothing.
 */
export function RouteChangeEvent() {
  const pathname = usePathname()
  const last = useRef(pathname)
  useEffect(() => {
    if (last.current === pathname) return
    last.current = pathname
    window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: pathname }))
  }, [pathname])
  return null
}
