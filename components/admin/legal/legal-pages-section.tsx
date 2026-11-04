"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Scale } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { ContentStatusPills } from "@/components/admin/kit/content-status"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { LEGAL_PAGES_KEY } from "@/components/admin/legal/legal-page-editor"
import { NewLegalPageDialog } from "@/components/admin/legal/new-legal-page-dialog"
import { PRIMARY_ACTION } from "@/components/admin/page-header"
import { SortableList } from "@/components/admin/sortable-list"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { LegalPageListItem } from "@/lib/schemas/api/legal-pages"

type Row = LegalPageListItem & { label: string }

/**
 * Pages › Legal pages: the pages linked from the footer after Privacy and
 * Terms, in the order shown here (drag, or Move up / Move down).
 */
export function LegalPagesSection() {
  const canCreate = usePermission({ page: ["create"] })
  const canReorder = usePermission({ page: ["update"] })
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const pages = useQuery({
    queryKey: LEGAL_PAGES_KEY,
    queryFn: () => unwrap(api["legal-pages"].$get()),
  })
  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      unwrap(api["legal-pages"].order.$put({ json: { ids } })),
    onSuccess: (data) => queryClient.setQueryData(LEGAL_PAGES_KEY, data),
    onError: (error) => {
      toast.error("The order was not saved", {
        description: errorMessage(error),
      })
      void queryClient.invalidateQueries({ queryKey: LEGAL_PAGES_KEY })
    },
  })

  const items: Row[] =
    pages.data?.items.map((page) => ({ ...page, label: page.title })) ?? []
  const now = pages.dataUpdatedAt

  return (
    <section aria-labelledby="pages-legal" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="pages-legal" className="text-card-title">
            Legal pages
          </h2>
          <p className="text-sm text-muted-foreground">
            Cookie Policy and the like, at their own addresses. Published ones
            are linked from the footer, after Privacy and Terms, in this order.
          </p>
        </div>
        {canCreate ? (
          <Button
            type="button"
            className={PRIMARY_ACTION}
            onClick={() => setCreating(true)}
          >
            New legal page
          </Button>
        ) : null}
      </div>
      <NewLegalPageDialog open={creating} onOpenChange={setCreating} />
      {pages.isPending ? (
        <div role="status">
          <span className="sr-only">Loading legal pages…</span>
          <CardSkeleton />
        </div>
      ) : pages.isError ? (
        <EmptyState
          icon={Scale}
          title="The legal pages didn't load"
          description={errorMessage(pages.error)}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => pages.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No legal pages yet"
          description={
            canCreate
              ? "Use New legal page to add a Cookie Policy or any other legal text."
              : "Legal pages appear here."
          }
        />
      ) : (
        <SortableList<Row>
          label="Legal pages, in footer order"
          items={items}
          disabled={!canReorder || reorder.isPending}
          onReorder={(next) => {
            // Show the new order at once; the response (or a refetch) settles it.
            queryClient.setQueryData(LEGAL_PAGES_KEY, { items: next })
            reorder.mutate(next.map((page) => page.id))
          }}
          renderContent={(page) => (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
              <Link
                href={`/admin/pages/legal/${page.id}`}
                className="w-fit font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {page.title}
              </Link>
              <code className="font-mono text-xs break-all text-muted-foreground">
                {page.path}
              </code>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <ContentStatusPills
                  record={{
                    published: page.status === "published" ? true : null,
                    dirty: page.hasUnpublishedChanges,
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  Updated{" "}
                  <RelativeTime
                    iso={page.updatedAt}
                    now={now}
                    suffix={
                      page.updatedByName
                        ? ` · ${page.updatedByName}`
                        : undefined
                    }
                  />
                </span>
              </div>
            </div>
          )}
        />
      )}
    </section>
  )
}
