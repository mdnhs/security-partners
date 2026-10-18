"use client"

import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { ActivityFeed } from "@/components/admin/kit/activity-feed"
import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { formatNumber } from "@/components/admin/kit/format"
import { KpiCard } from "@/components/admin/kit/kpi-card"
import { PillBarChart } from "@/components/admin/kit/pill-bar-chart"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import {
  LINK_PRIMARY,
  LINK_SECONDARY,
  PageHeader,
  PRIMARY_ACTION,
} from "@/components/admin/page-header"
import { useSiteInfo } from "@/components/admin/shell/site-context"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { describeActivity } from "@/lib/admin/activity"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { DashboardDto } from "@/lib/schemas/api/dashboard"
import { cn } from "@/lib/utils"

import { ContentHealthCard } from "./content-health"
import { DashboardSkeleton } from "./dashboard-skeleton"
import { NextUp } from "./next-up"
import { greetingFor, weeklyBuckets } from "./present"

type Kpi = {
  label: string
  value: string
  caption: string
  href?: string
}

function kpisFor(dto: DashboardDto, canReadPages: boolean): Kpi[] {
  const { kpis } = dto
  const out: Kpi[] = []
  if (kpis.leads30d !== null)
    out.push({
      label: "New enquiries",
      value: formatNumber(kpis.leads30d),
      caption: "last 30 days",
    })
  if (kpis.openLeads !== null)
    out.push({
      label: "Open enquiries",
      value: formatNumber(kpis.openLeads),
      caption: "new, contacted or qualified",
    })
  if (kpis.published) {
    const { pages, services, articles } = kpis.published
    out.push({
      label: "Published content",
      value: formatNumber(pages + services + articles),
      caption: `${pages} pages · ${services} services · ${articles} articles`,
      href: canReadPages ? "/admin/pages" : undefined,
    })
  }
  if (kpis.inReview !== null)
    out.push({
      label: "Drafts in review",
      value: formatNumber(kpis.inReview),
      caption: "articles waiting for an editor",
    })
  return out
}

/** JW dashboard: greeting + button pair, KPI row, trend, Next up, team activity. */
export function Dashboard({
  firstName,
  renderedAt,
}: {
  firstName: string
  renderedAt: string
}) {
  const site = useSiteInfo()
  const canCreateService = usePermission({ service: ["create"] })
  const canReadPages = usePermission({ page: ["read"] })
  const canReadAudit = usePermission({ audit: ["read"] })
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => unwrap(api.dashboard.$get()),
    staleTime: 60_000,
  })
  const activity = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => unwrap(api.audit.$get({ query: { pageSize: "6" } })),
    enabled: canReadAudit,
    staleTime: 60_000,
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greetingFor(new Date(renderedAt))}, ${firstName}`}
        titleTestId="greeting"
        description="Here's what's happening on the website."
        actions={
          <>
            {canCreateService ? (
              <Link href="/admin/services/new" className={LINK_PRIMARY}>
                <Plus aria-hidden data-icon="inline-start" />
                New service
              </Link>
            ) : null}
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer"
              className={LINK_SECONDARY}
            >
              View site
              {/* Whitespace-only text is dropped by the flex layout. */}{" "}
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </>
        }
      />
      {query.isPending ? (
        <>
          <p role="status" className="sr-only">
            Loading dashboard…
          </p>
          <DashboardSkeleton />
        </>
      ) : query.isError ? (
        <EmptyState
          role="alert"
          title="The dashboard didn't load"
          description={errorMessage(query.error)}
          action={
            <Button className={PRIMARY_ACTION} onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <Body
          dto={query.data}
          kpis={kpisFor(query.data, canReadPages)}
          activity={
            canReadAudit ? (
              <TeamActivity
                query={activity}
                // Relative times count from the fetch, not the page render.
                now={activity.dataUpdatedAt || Date.parse(renderedAt)}
              />
            ) : null
          }
        />
      )}
    </div>
  )
}

type ActivityRow = {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  actor: { name: string | null; email: string | null } | null
  createdAt: string
}

function TeamActivity({
  query,
  now,
}: {
  query: UseQueryResult<{ items: ActivityRow[] }>
  now: number
}) {
  if (query.isPending)
    return (
      <>
        <p role="status" className="sr-only">
          Loading activity…
        </p>
        <CardSkeleton className="h-40" />
      </>
    )
  if (query.isError)
    return (
      <EmptyState
        role="alert"
        title="Team activity didn't load"
        description={errorMessage(query.error)}
        action={
          <Button className={PRIMARY_ACTION} onClick={() => query.refetch()}>
            Try again
          </Button>
        }
      />
    )
  return (
    <ActivityFeed
      label="Team activity list"
      now={now}
      emptyTitle="No activity yet"
      emptyDescription="Publishing, edits and sign-ins by your team will show here."
      entries={query.data.items.map((row) => {
        const summary = describeActivity(row)
        return {
          id: row.id,
          name: row.actor?.name ?? row.actor?.email ?? "System",
          description: summary.text,
          at: row.createdAt,
          status: summary.status,
        }
      })}
    />
  )
}

function Body({
  dto,
  kpis,
  activity,
}: {
  dto: DashboardDto
  kpis: Kpi[]
  /** The Team activity card's body; null when the role may not read the audit log. */
  activity: ReactNode
}) {
  // The Content health gauge (hidden without seo:read) sits beside the feed.
  const canReadSeo = usePermission({ seo: ["read"] })
  const weeks = dto.leadsTrend ? weeklyBuckets(dto.leadsTrend) : null
  const quiet = weeks?.every((week) => week.current === 0) ?? false
  return (
    <>
      {/* KPI cards title themselves with h3s; keep the outline continuous. */}
      <h2 className="sr-only">Key figures</h2>
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          kpis.length > 3 ? "xl:grid-cols-4" : "xl:grid-cols-3"
        )}
      >
        {kpis.map((kpi, index) => (
          <KpiCard
            key={kpi.label}
            variant={index === 0 ? "hero" : "default"}
            {...kpi}
          />
        ))}
      </div>
      <div
        className={cn(
          "grid gap-4",
          weeks && "xl:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        {weeks ? (
          <DashboardCard title="Enquiries, last 90 days">
            <div className="relative">
              <PillBarChart
                title="Enquiries, last 90 days"
                rowHeader="Week of"
                currentLabel="Enquiries"
                data={weeks}
              />
              {quiet ? (
                <>
                  {/* The table already lists the zeros; the overlay is decoration. */}
                  <p className="sr-only">No enquiries in the last 90 days.</p>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 flex h-64 flex-col items-center justify-center gap-1 text-center"
                  >
                    <p className="text-base font-semibold">No enquiries yet</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Each week&apos;s enquiries from the contact form will show
                      here.
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </DashboardCard>
        ) : null}
        <NextUp items={dto.nextUp} />
      </div>
      <div
        className={cn(
          "grid gap-4",
          activity && canReadSeo && "xl:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        {activity ? (
          <DashboardCard title="Team activity">{activity}</DashboardCard>
        ) : null}
        <ContentHealthCard />
      </div>
    </>
  )
}
