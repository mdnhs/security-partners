"use client"

import { useEffect } from "react"

import { CONSENT_EVENT } from "@/lib/analytics/snippets"
import {
  analyticsConsent,
  captureAttribution,
  clearAttribution,
  sessionStore,
} from "@/lib/leads/attribution"

/**
 * Stores the visit's first touch (referrer, landing page, UTM tags) in
 * sessionStorage for the contact form (D3.1), only with analytics consent
 * (ePrivacy: non-essential device storage).
 *
 * Uses the ConsentProvider's window contract (`__spConsent` + `sp:consent`),
 * not useConsent(): the provider is mounted only while tracking is on, and
 * its event may fire before or after this effect. Consent given later in
 * the visit captures the page the visitor is on then; a refusal or
 * withdrawal removes the value. Before the provider has published anything
 * nothing changes, so a later page load keeps the first touch. With
 * tracking off there is no consent, so nothing is ever stored.
 *
 * Renders nothing, sets no cookie and sends nothing.
 */
export function AttributionCapture() {
  useEffect(() => {
    const sync = () => {
      const consent = analyticsConsent()
      if (consent === undefined) return
      const store = sessionStore()
      if (consent) captureAttribution(window.location, document.referrer, store)
      else clearAttribution(store)
    }
    sync()
    window.addEventListener(CONSENT_EVENT, sync)
    return () => window.removeEventListener(CONSENT_EVENT, sync)
  }, [])
  return null
}
