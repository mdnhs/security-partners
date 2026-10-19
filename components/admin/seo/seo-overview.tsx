"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { Gauge } from "@/components/admin/kit/gauge"
import { CardSkeleton, KpiRowSkeleton } from "@/components/admin/kit/skeletons"
import { PageHeader, PRIMARY_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import {
  SEO_KINDS,
  type SeoHealthDto,
  type SeoKind,
} from "@/lib/schemas/api/seo"

import { AltTextCard } from "./alt-text-card"
import { healthParts } from "./health"
import { type IssueGroup, IssuesList, issuesFilterOf } from "./issues-list"
import { SEO_HEALTH_KEY, SEO_OVERVIEW_KEY } from "./keys"
import { SeoSheet, SeoSheetPlaceholder } from "./seo-sheet"

const isRecordKind = (kind: string): kind is SeoKind =>
  (SEO_KINDS as readonly string[]).includes(kind)

const keyOf = (entry: { kind: string; id: string }) =>
  `${entry.kind}:${entry.id}`

/**
 * SEO › Overview: health gauge, alt-text coverage, issues grouped per
 * record with Fix links (Needs work / All, ?show=), and the SEO sheet
 * (?edit=).
 */
export function SeoOverview({ origin }: { origin: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const editing = params.get("edit")
  const health = useQuery({
    queryKey: SEO_HEALTH_KEY,
    queryFn: () => unwrap(api.seo.health.$get()),
  })
  // The sheet edits a record's SEO entry: loaded only while one is open.
  const overview = useQuery({
    queryKey: SEO_OVERVIEW_KEY,
    queryFn: () => unwrap(api.seo.overview.$get()),
    enabled: editing !== null,
  })
  const setEditing = (value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set("edit", value)
    else next.delete("edit")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const entry =
    editing && overview.data
      ? (overview.data.entries.find((e) => keyOf(e) === editing) ?? null)
      : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="SEO" description="How search engines see the site." />
      {health.isPending ? (
        <>
          <KpiRowSkeleton />
          <CardSkeleton />
        </>
      ) : health.isError ? (
        <EmptyState
          role="alert"
          title="SEO health didn't load"
          description={errorMessage(health.error)}
          action={
            <Button
              className={PRIMARY_ACTION}
              onClick={() => void health.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : (
        <Loaded
          data={health.data}
          filter={issuesFilterOf(params.get("show"))}
          onEdit={(g) => setEditing(keyOf(g))}
        />
      )}
      {entry ? (
        <SeoSheet
          key={keyOf(entry)}
          entry={entry}
          origin={origin}
          defaults={overview.data?.defaults}
          onClose={() => setEditing(null)}
        />
      ) : editing ? (
        // Loading, failed or unknown record: say so in the sheet.
        <SeoSheetPlaceholder
          state={
            overview.isFetching
              ? "loading"
              : overview.isError
                ? "error"
                : overview.data
                  ? "missing"
                  : "loading"
          }
          error={overview.error ? errorMessage(overview.error) : undefined}
          onRetry={() => void overview.refetch()}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function Loaded({
  data,
  filter,
  onEdit,
}: {
  data: SeoHealthDto
  filter: ReturnType<typeof issuesFilterOf>
  onEdit: (group: IssueGroup) => void
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const live = data.entities.filter((e) => e.published)
  const needWork = live.filter((e) => e.results.some((r) => !r.ok)).length
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <DashboardCard title="SEO health">
          {data.total === 0 ? (
            <EmptyState
              title="Nothing published yet"
              description="Checks run on published pages, services and articles."
            />
          ) : (
            <Gauge
              title="SEO health"
              centerLabel="Passing"
              headlineKey="passed"
              parts={healthParts(data)}
            />
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {needWork === 0
              ? "Every published page passes the checks."
              : `${needWork} of ${live.length} published pages need attention.`}
          </p>
        </DashboardCard>
        <AltTextCard alt={data.alt} />
      </div>
      <DashboardCard title="Pages and posts">
        <IssuesList
          issues={data.issues}
          entities={data.entities}
          filter={filter}
          renderAction={(group) =>
            isRecordKind(group.kind) ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 self-start rounded-xl bg-card pointer-coarse:h-11"
                aria-label={`${canEdit ? "Edit" : "View"} SEO for ${group.title}`}
                onClick={() => onEdit(group)}
              >
                {canEdit ? "Edit SEO" : "View SEO"}
              </Button>
            ) : null
          }
        />
      </DashboardCard>
    </div>
  )
}
