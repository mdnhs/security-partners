"use client"

import { useEffect } from "react"

import {
  NEWSLETTER_TOKEN_STRIPPED,
  stripNewsletterToken,
} from "@/lib/newsletter/placement"

/**
 * Once hydrated, removes `?token` from the address bar so nothing that reads
 * location.href later (owner custom code, tags after a soft navigation, a
 * copied link) sees it. The token is already in the form's hidden field.
 * Renders nothing; submits nothing.
 */
export function StripNewsletterToken() {
  useEffect(() => {
    if (stripNewsletterToken(window))
      window.dispatchEvent(new Event(NEWSLETTER_TOKEN_STRIPPED))
  }, [])
  return null
}
