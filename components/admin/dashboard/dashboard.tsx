"use client"

import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { ActivityFeed } from "@/components/admin/kit/activity-feed"
import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { formatNumber } from "@/components/admin/kit/format"
import { KpiCard, type KpiCardProps } from "@/components/admin/kit/kpi-card"
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

type Kpi = Pick<KpiCardProps, "label" | "value" | "caption" | "href">

/** Content list the role may open, for the Published content chip. */
type ContentAccess = { pages: boolean; services: boolean; articles: boolean }

function contentHref(access: ContentAccess): string {
  if (access.pages) return "/admin/pages"
  if (access.services) return "/admin/services"
  return "/admin/insights"
}

/** Every KPI links its chip to the screen it counts (the API gates each part). */
function kpisFor(dto: DashboardDto, access: ContentAccess): Kpi[] {
  const { kpis } = dto
  const out: Kpi[] = []
  if (kpis.leads30d !== null)
    out.push({
      label: "New enquiries",
      value: formatNumber(kpis.leads30d),
      caption: "last 30 days",
      href: "/admin/leads",
    })
  if (kpis.openLeads !== null)
    out.push({
      label: "Open enquiries",
      value: formatNumber(kpis.openLeads),
      caption: "new, contacted or qualified",
      href: "/admin/leads",
    })
  if (kpis.published) {
    const { pages, services, articles } = kpis.published
    out.push({
      label: "Published content",
      value: formatNumber(pages + services + articles),
      caption: `${pages} pages · ${services} services · ${articles} articles`,
      href: contentHref(access),
    })
  }
  if (kpis.inReview !== null)
    out.push({
      label: "Drafts in review",
      value: formatNumber(kpis.inReview),
      caption: "articles waiting for an editor",
      href: "/admin/insights?status=in_review",
    })
  if (kpis.subscribers)
    out.push({
      label: "Newsletter subscribers",
      value: formatNumber(kpis.subscribers.confirmed),
      caption: `${formatNumber(kpis.subscribers.since30d)} new in the last 30 days`,
      href: "/admin/newsletter",
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
  const canReadServices = usePermission({ service: ["read"] })
  const canReadArticles = usePermission({ article: ["read"] })
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
          kpis={kpisFor(query.data, {
            pages: canReadPages,
            services: canReadServices,
            articles: canReadArticles,
          })}
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
  /** The Team activity card's body; null when the role may not read the activity log. */
  activity: ReactNode
}) {
  // The Content health gauge (hidden without seo:read) sits beside the feed.
  const canReadSeo = usePermission({ seo: ["read"] })
  const weeks = dto.leadsTrend ? weeklyBuckets(dto.leadsTrend) : null
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
            <PillBarChart
              ariaLabel="Enquiries, last 90 days"
              // The card's title already names this region.
              labelFigure={false}
              rowHeader="Week of"
              legend={{ current: "Enquiries", previous: "Previous period" }}
              emptyText="No enquiries yet"
              data={weeks}
            />
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
