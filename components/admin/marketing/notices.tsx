"use client"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ANALYTICS_EVENTS } from "@/lib/analytics/events"

/** Side card on Marketing › Tracking: the consent rules the site follows. */
export function TrackingNotice() {
  return (
    <DashboardCard title="What loads when" headingLevel={2}>
      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="font-semibold">Before a choice, or after Reject</dt>
          <dd className="text-muted-foreground">Nothing is loaded.</dd>
        </div>
        <div>
          <dt className="font-semibold">Analytics consent</dt>
          <dd className="text-muted-foreground">
            Google Tag Manager and Google Analytics 4 (with Consent Mode).
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Marketing consent</dt>
          <dd className="text-muted-foreground">Meta Pixel.</dd>
        </div>
        <div>
          <dt className="font-semibold">Events sent to the data layer</dt>
          <dd className="font-mono text-xs text-muted-foreground">
            {ANALYTICS_EVENTS.join(", ")}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        Visitors keep their choice for 6 months and can change it with the
        “Cookie settings” button.
      </p>
    </DashboardCard>
  )
}

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
