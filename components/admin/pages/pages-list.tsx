"use client"

import { useQuery } from "@tanstack/react-query"
import { FileText } from "lucide-react"
import Link from "next/link"

import { ContentStatusPills } from "@/components/admin/kit/content-status"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { PageListItem } from "@/lib/schemas/api/content"

const stateOf = (page: PageListItem) => ({
  published: page.publishedAt ? true : null,
  dirty: page.dirty,
})

/** Relative to the last fetch, so it moves on with every refetch. */
function Updated({ page, now }: { page: PageListItem; now: number }) {
  return (
    <RelativeTime
      iso={page.updatedAt}
      now={now}
      suffix={page.updatedBy ? ` · ${page.updatedBy.name}` : undefined}
    />
  )
}

/** The eight fixed pages (JW pages list): card table ≥ 640 px, cards below. */
export function PagesList() {
  const pages = useQuery({
    queryKey: ["pages"],
    queryFn: () => unwrap(api.pages.$get()),
  })
  if (pages.isPending)
    return (
      <div role="status">
        <span className="sr-only">Loading pages…</span>
        <CardSkeleton />
      </div>
    )
  if (pages.isError)
    return (
      <EmptyState
        role="alert"
        title="The pages didn't load"
        description={errorMessage(pages.error)}
        action={
          <Button
            type="button"
            className={FORM_ACTION}
            onClick={() => pages.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  const items = pages.data.items
  const now = pages.dataUpdatedAt
  if (items.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title="No pages yet"
        description="The site's pages appear here once the content is seeded."
      />
    )
  return (
    <>
      <div
        data-slot="table-card"
        className="rounded-card hidden overflow-x-auto bg-card sm:block"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Pages</caption>
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th scope="col" className="h-12 px-4 font-medium">
                Title
              </th>
              <th scope="col" className="h-12 px-4 font-medium">
                Address
              </th>
              <th scope="col" className="h-12 px-4 font-medium">
                Status
              </th>
              <th scope="col" className="h-12 px-4 font-medium">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((page) => (
              <tr key={page.key} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/pages/${page.key}`}
                    className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {page.label}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <code className="font-mono text-xs text-muted-foreground">
                    {page.path}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <ContentStatusPills record={stateOf(page)} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Updated page={page} now={now} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label="Pages" className="flex flex-col gap-3 sm:hidden">
        {items.map((page) => (
          <li key={page.key} className="rounded-card relative bg-card p-4">
            <div className="flex flex-col gap-2 text-sm">
              <Link
                href={`/admin/pages/${page.key}`}
                className="after:rounded-card font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                {page.label}
              </Link>
              <code className="font-mono text-xs text-muted-foreground">
                {page.path}
              </code>
              <ContentStatusPills record={stateOf(page)} />
              <p className="text-xs text-muted-foreground">
                Updated <Updated page={page} now={now} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
