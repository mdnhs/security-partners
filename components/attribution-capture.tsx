"use client"

import { useEffect } from "react"

import { captureAttribution, sessionStore } from "@/lib/leads/attribution"

/**
 * Stores the visit's first touch (referrer, landing page, UTM tags) in
 * sessionStorage for the contact form (D3.1). Renders nothing, sets no
 * cookie and sends nothing: the data leaves the browser only with an
 * enquiry the visitor submits.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution(window.location, document.referrer, sessionStore())
  }, [])
  return null
}
