"use client"

import { CircleCheck } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { type ReactNode, useId } from "react"

import { EmptyState } from "@/components/admin/kit/empty-state"
import { StatusPill } from "@/components/admin/kit/status-pill"
import type { SeoHealthDto, SeoIssueDto } from "@/lib/schemas/api/seo"
import { cn } from "@/lib/utils"

import { MISSING_ALT_HREF } from "./alt-text-card"

/** Needs work (default) or All (?show=all). */
export type IssuesFilter = "needs-work" | "all"

export const issuesFilterOf = (show: string | null): IssuesFilter =>
  show === "all" ? "all" : "needs-work"

type Entity = SeoHealthDto["entities"][number]

/** One group: a record (or an image) with its failed checks. */
export type IssueGroup = {
  kind: SeoIssueDto["kind"]
  id: string
  title: string
  path: string | null
  published: boolean
  issues: SeoIssueDto[]
}

const KIND_LABEL: Record<SeoIssueDto["kind"], string> = {
  page: "Page",
  service: "Service",
  article: "Article",
  builder: "Page",
  media: "Image",
}

const keyOf = (g: { kind: string; id: string }) => `${g.kind}:${g.id}`

/**
 * Issues grouped per entity, in the API's order (records, then images).
 * "all" also lists the entities without issues (passing or unpublished).
 */
export function groupIssues(
  issues: SeoIssueDto[],
  entities: Entity[],
  filter: IssuesFilter
): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  if (filter === "all")
    for (const e of entities)
      groups.set(keyOf(e), {
        kind: e.kind,
        id: e.id,
        title: e.title,
        path: e.path,
        published: e.published,
        issues: [],
      })
  for (const issue of issues) {
    const k = keyOf(issue)
    let group = groups.get(k)
    if (!group) {
      group = {
        kind: issue.kind,
        id: issue.id,
        title: issue.title,
        path: issue.path,
        published: true,
        issues: [],
      }
      groups.set(k, group)
    }
    group.issues.push(issue)
  }
  return [...groups.values()]
}

/** Image groups shown before pointing to the media library's filter. */
export const IMAGE_GROUP_LIMIT = 10

/** 44 px on touch (WCAG 2.5.8 + project rule). */
const COARSE_TARGET = "pointer-coarse:h-11 pointer-coarse:min-w-11"

const SEGMENT = cn(
  "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
  COARSE_TARGET
)
const SEGMENT_ACTIVE = "bg-card text-foreground shadow-sm"

/** Needs work / All as a segmented control; the choice lives in ?show=. */
function FilterControl({ filter }: { filter: IssuesFilter }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const hrefFor = (value: IssuesFilter) => {
    const next = new URLSearchParams(params.toString())
    if (value === "all") next.set("show", "all")
    else next.delete("show")
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }
  const items: { value: IssuesFilter; label: string }[] = [
    { value: "needs-work", label: "Needs work" },
    { value: "all", label: "All" },
  ]
  return (
    <nav
      aria-label="Issue filter"
      className="inline-flex gap-1 self-start rounded-lg bg-muted p-1"
    >
      {items.map((item) => {
        const active = item.value === filter
        return (
          <Link
            key={item.value}
            href={hrefFor(item.value)}
            // A click pushes: Back restores the previous filter.
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(SEGMENT, active && SEGMENT_ACTIVE)}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * SEO › Overview issues, grouped per entity: title, path, one row per issue
 * with a Fix link (the issue's fixHref). `renderAction` adds a per-record
 * control (the overview's Edit SEO sheet button).
 */
export function IssuesList({
  issues,
  entities,
  filter,
  renderAction,
}: {
  issues: SeoIssueDto[]
  entities: Entity[]
  filter: IssuesFilter
  renderAction?: (group: IssueGroup) => ReactNode
}) {
  const all = groupIssues(issues, entities, filter)
  // A large library can have many images without alt text: show the first
  // few, the media library's filter lists the rest.
  const images = all.filter((g) => g.kind === "media")
  const hiddenImages = Math.max(0, images.length - IMAGE_GROUP_LIMIT)
  const shown = new Set(images.slice(0, IMAGE_GROUP_LIMIT))
  const groups = all.filter((g) => g.kind !== "media" || shown.has(g))
  return (
    <div className="flex flex-col gap-4">
      <FilterControl filter={filter} />
      {groups.length === 0 ? (
        filter === "needs-work" ? (
          <EmptyState
            role="status"
            icon={CircleCheck}
            title="Nothing to fix"
            description="Every check passes on published pages, services and articles."
          />
        ) : (
          <EmptyState
            role="status"
            title="Nothing to check yet"
            description="Checks run on published pages, services and articles."
          />
        )
      ) : (
        <ul role="list" className="flex flex-col divide-y">
          {groups.map((group) => (
            <li key={keyOf(group)}>
              <Group group={group} action={renderAction?.(group)} />
            </li>
          ))}
        </ul>
      )}
      {hiddenImages > 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            {hiddenImages === 1
              ? "1 more image without alt text."
              : `${hiddenImages} more images without alt text.`}
          </span>
          <Link
            href={MISSING_ALT_HREF}
            className={cn(
              "inline-flex items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              COARSE_TARGET
            )}
          >
            Find images without alt text
          </Link>
        </p>
      ) : null}
    </div>
  )
}

function Group({ group, action }: { group: IssueGroup; action: ReactNode }) {
  const headingId = useId()
  return (
    // An article, not a region: dozens of groups must not flood the
    // landmarks list.
    <article aria-labelledby={headingId} className="flex flex-col gap-2 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {KIND_LABEL[group.kind]}
          </p>
          <h3 id={headingId} className="font-semibold break-words">
            {group.title}
          </h3>
          {group.path ? (
            <code className="font-mono text-xs break-all text-muted-foreground">
              {group.path}
            </code>
          ) : null}
        </div>
        {action}
      </div>
      {!group.published ? (
        <StatusPill tone="neutral" className="self-start">
          Not published
        </StatusPill>
      ) : group.issues.length === 0 ? (
        <StatusPill tone="success" className="self-start">
          All checks pass
        </StatusPill>
      ) : (
        <ul role="list" className="flex flex-col gap-1">
          {group.issues.map((issue) => (
            <li
              key={issue.check}
              className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="min-w-0">{issue.message}</span>
              <Link
                href={issue.fixHref}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2 font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  COARSE_TARGET
                )}
              >
                Fix
                <span className="sr-only">
                  {` ${group.title}: ${issue.message}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
