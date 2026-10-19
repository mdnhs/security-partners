"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/** Warning on Marketing › Custom code (owner only). */
export function CustomCodeNotice() {
  return (
    <Alert role="alert">
      <AlertTitle>Code here runs on every public page</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>
          It has full access to every visitor&apos;s page. Paste only code from
          vendors you trust, and remove it when you stop using the service.
        </span>
        <span>
          It is added after the page loads, so verify domains (Google, Meta …)
          by DNS rather than with a meta tag.
        </span>
        <span>
          It runs without the visitor&apos;s consent, so anything that sets
          cookies or tracks visitors needs consent — use Tracking for it, not
          this page. If a Content-Security-Policy is added to the site, its
          script, connect and image sources must allow the hosts used here (see
          the runbook).
        </span>
      </AlertDescription>
    </Alert>
  )
}
