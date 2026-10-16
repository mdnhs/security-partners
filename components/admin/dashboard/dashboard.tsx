"use client"

import { useQuery } from "@tanstack/react-query"

import { formatNumber } from "@/components/admin/kit/format"
import { KpiCard } from "@/components/admin/kit/kpi-card"
import { CardSkeleton, KpiRowSkeleton } from "@/components/admin/kit/skeletons"
import { Button } from "@/components/ui/button"
import { api, errorMessage, unwrap } from "@/lib/api-client"

import { LeadsChart } from "./leads-chart"
import { NextUp } from "./next-up"

/**
 * KPIs, 90-day trend and Next up (master 4.7), fed by GET /dashboard.
 * Interim layout: Phase 4b Task 11 restyles it in the JW layout.
 */
export function Dashboard() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => unwrap(api.dashboard.$get()),
    staleTime: 60_000,
  })
  if (query.isPending)
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="sr-only">
          Loading dashboard…
        </p>
        <KpiRowSkeleton />
        <CardSkeleton className="h-56" />
      </div>
    )
  if (query.isError)
    return (
      <div
        role="alert"
        className="rounded-card flex flex-col items-start gap-3 bg-card p-6"
      >
        <p className="text-sm">{errorMessage(query.error)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
        >
          Try again
        </Button>
      </div>
    )
  const { kpis, leadsTrend, nextUp } = query.data
  const published = kpis.published
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.leads30d !== null ? (
          <KpiCard
            headingLevel={2}
            variant="hero"
            label="Enquiries (30 days)"
            value={formatNumber(kpis.leads30d)}
            caption="Excluding spam"
          />
        ) : null}
        {kpis.openLeads !== null ? (
          <KpiCard
            headingLevel={2}
            label="Open enquiries"
            value={formatNumber(kpis.openLeads)}
            caption="New, contacted or qualified"
          />
        ) : null}
        {published ? (
          <KpiCard
            headingLevel={2}
            label="Published content"
            value={formatNumber(
              published.pages + published.services + published.articles
            )}
            caption={`${published.pages} pages · ${published.services} services · ${published.articles} articles`}
          />
        ) : null}
        {kpis.inReview !== null ? (
          <KpiCard
            headingLevel={2}
            label="Drafts in review"
            value={formatNumber(kpis.inReview)}
            caption="Articles waiting for an editor"
          />
        ) : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {leadsTrend ? <LeadsChart data={leadsTrend} /> : null}
        <NextUp items={nextUp} />
      </div>
    </div>
  )
}
