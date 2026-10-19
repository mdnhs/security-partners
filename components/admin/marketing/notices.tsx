"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/** Warning on Marketing › Custom code (owner only). */
export function CustomCodeNotice() {
  return (
    <Alert role="alert">
      <AlertTitle>Code here runs on the public site</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>
          It has full access to every visitor&apos;s page it runs on. Paste only
          code from vendors you trust, and remove it when you stop using the
          service.
        </span>
        <span>
          It is added after the page loads, so verify domains (Google, Meta …)
          by DNS rather than with a meta tag.
        </span>
        <span>
          Anything that sets cookies or tracks visitors needs consent: give it
          the Analytics or Marketing category, so it waits for the
          visitor&apos;s choice. Only &quot;necessary&quot; snippets run without
          consent. If a Content-Security-Policy is added to the site, its
          script, connect and image sources must allow the hosts used here (see
          the runbook).
        </span>
      </AlertDescription>
    </Alert>
  )
}

/** Shown on Marketing › Custom code while the kill switch is on (published). */
export function CustomCodeOffNotice() {
  return (
    <Alert role="status" variant="destructive">
      <AlertTitle>Custom code is switched off</AlertTitle>
      <AlertDescription>
        No snippet runs on the public site. It was switched off here or with{" "}
        <code>pnpm custom-code:off</code> on the server (see Activity). To turn
        it back on, switch &quot;Switch all custom code off&quot; off and
        publish.
      </AlertDescription>
    </Alert>
  )
}
