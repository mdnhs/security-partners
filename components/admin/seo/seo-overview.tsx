"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { Gauge } from "@/components/admin/kit/gauge"
import { CardSkeleton, KpiRowSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { PageHeader, PRIMARY_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { SeoEntry, SeoKind, SeoOverviewDto } from "@/lib/schemas/api/seo"

import { healthParts } from "./health"
import { SEO_OVERVIEW_KEY } from "./keys"
import { SeoSheet } from "./seo-sheet"

const GROUPS: { kind: SeoKind; title: string }[] = [
  { kind: "page", title: "Pages" },
  { kind: "service", title: "Services" },
  { kind: "article", title: "Articles" },
]

const keyOf = (entry: Pick<SeoEntry, "kind" | "id">) =>
  `${entry.kind}:${entry.id}`

/** SEO › Overview: health gauge, every record's checks, the SEO sheet (?edit=). */
export function SeoOverview({ origin }: { origin: string }) {
  const query = useQuery({
    queryKey: SEO_OVERVIEW_KEY,
    queryFn: () => unwrap(api.seo.overview.$get()),
  })
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const editing = params.get("edit")
  const setEditing = (value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set("edit", value)
    else next.delete("edit")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const entry =
    editing && query.data
      ? (query.data.entries.find((e) => keyOf(e) === editing) ?? null)
      : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="SEO" description="How search engines see the site." />
      {query.isPending ? (
        <>
          <KpiRowSkeleton />
          <CardSkeleton />
        </>
      ) : query.isError ? (
        <EmptyState
          role="alert"
          title="SEO health didn't load"
          description={errorMessage(query.error)}
          action={
            <Button
              className={PRIMARY_ACTION}
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : (
        <Loaded data={query.data} onEdit={(e) => setEditing(keyOf(e))} />
      )}
      {entry ? (
        <SeoSheet
          key={keyOf(entry)}
          entry={entry}
          origin={origin}
          defaults={query.data?.defaults}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function Loaded({
  data,
  onEdit,
}: {
  data: SeoOverviewDto
  onEdit: (entry: SeoEntry) => void
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const live = data.entries.filter((e) => e.published)
  const needWork = live.filter((e) => e.issues.length > 0).length
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <DashboardCard title="SEO health">
        {data.checks.total === 0 ? (
          <EmptyState
            title="Nothing published yet"
            description="Checks run on published pages, services and articles."
          />
        ) : (
          <Gauge
            title="SEO health"
            centerLabel="Passing"
            headlineKey="passed"
            parts={healthParts(data.checks)}
          />
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {needWork === 0
            ? "Every published page passes the checks."
            : `${needWork} of ${live.length} published pages need attention.`}
        </p>
      </DashboardCard>
      <DashboardCard title="Pages and posts">
        <div className="flex flex-col gap-6">
          {GROUPS.map((group) => {
            const entries = data.entries.filter((e) => e.kind === group.kind)
            if (entries.length === 0) return null
            const headingId = `seo-group-${group.kind}`
            return (
              <section
                key={group.kind}
                aria-labelledby={headingId}
                className="flex flex-col gap-2"
              >
                <h3
                  id={headingId}
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {group.title}
                </h3>
                <ul role="list" className="flex flex-col divide-y">
                  {entries.map((entry) => (
                    <li
                      key={keyOf(entry)}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="font-semibold">{entry.name}</p>
                        <code className="font-mono text-xs text-muted-foreground">
                          {entry.path}
                        </code>
                        <div className="flex flex-wrap gap-2">
                          {!entry.published ? (
                            <StatusPill tone="neutral">
                              Not published
                            </StatusPill>
                          ) : entry.issues.length === 0 ? (
                            <StatusPill tone="success">
                              All checks pass
                            </StatusPill>
                          ) : null}
                          {entry.seo.noindex ? (
                            <StatusPill tone="warning">
                              Hidden from search
                            </StatusPill>
                          ) : null}
                        </div>
                        {entry.issues.length > 0 ? (
                          <ul
                            role="list"
                            className="list-disc pl-5 text-sm text-muted-foreground"
                          >
                            {entry.issues.map((issue) => (
                              <li key={issue.check}>{issue.message}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 shrink-0 self-start rounded-xl bg-card pointer-coarse:h-11"
                        aria-label={`${canEdit ? "Edit" : "View"} SEO for ${entry.name}`}
                        onClick={() => onEdit(entry)}
                      >
                        {canEdit ? "Edit SEO" : "View SEO"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </DashboardCard>
    </div>
  )
}
