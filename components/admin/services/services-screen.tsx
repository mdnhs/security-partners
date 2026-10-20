"use client"

import { ArrowUpDown, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import {
  loadAllPages,
  ReorderPanel,
} from "@/components/admin/collections/reorder-panel"
import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { ContentStatusPills } from "@/components/admin/kit/content-status"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import {
  LINK_PRIMARY,
  PageHeader,
  SECONDARY_ACTION,
} from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"
import type { ServiceListItem } from "@/lib/schemas/api/services"

type Row = ServiceListItem & Record<string, unknown>
const ch = columnsFor<Row>()

const columns = ch.columns([
  ch.accessor("title", {
    header: "Service",
    cell: (info) => (
      <Link
        href={`/admin/services/${info.row.original.id}`}
        className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  ch.accessor("slug", {
    header: "Address",
    enableSorting: false,
    cell: (info) => (
      <code className="font-mono text-xs text-muted-foreground">
        /services/{info.getValue()}
      </code>
    ),
  }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <ContentStatusPills
        record={{
          published: row.original.publishedAt ? true : null,
          dirty: row.original.dirty,
        }}
      />
    ),
  }),
  ch.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => (
      <span className="text-muted-foreground">
        <RelativeTime iso={info.getValue()} />
      </span>
    ),
  }),
]) as unknown as DataTableColumns<Row>

const queryKey = ["services"] as const

/** Services list (draft/publish records), new service, display order. */
export function ServicesScreen() {
  const canCreate = usePermission({ service: ["create"] })
  const canUpdate = usePermission({ service: ["update"] })
  const [reordering, setReordering] = useState(false)
  return (
    <>
      <PageHeader
        title="Services"
        description="Each service has a card on /services and its own page. Edits are drafts until published."
        actions={
          <>
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                className={SECONDARY_ACTION}
                onClick={() => setReordering((v) => !v)}
                aria-pressed={reordering}
              >
                <ArrowUpDown aria-hidden />
                {reordering ? "Back to list" : "Change order"}
              </Button>
            ) : null}
            {canCreate ? (
              <Link href="/admin/services/new" className={LINK_PRIMARY}>
                <Plus aria-hidden />
                New service
              </Link>
            ) : null}
          </>
        }
      />
      {reordering ? (
        <ReorderPanel
          collection="services"
          label="Services order"
          queryKey={queryKey}
          load={async () => {
            const items = await loadAllPages((page, pageSize) =>
              unwrap(
                api.services.$get({
                  query: {
                    page: String(page),
                    pageSize: String(pageSize),
                    sort: "sortOrder:asc",
                  },
                })
              )
            )
            return items.map((s) => ({
              id: s.id,
              label: s.title,
              description: `/services/${s.slug}`,
            }))
          }}
          onDone={() => setReordering(false)}
        />
      ) : (
        <DataTable<Row>
          syncUrl
          label="Services"
          queryKey={queryKey}
          fetchPage={async (params) =>
            (await unwrap(
              api.services.$get({
                query: {
                  page: String(params.page),
                  pageSize: String(params.pageSize),
                  sort: params.sort,
                  q: params.q,
                },
              })
            )) as {
              items: Row[]
              page: number
              pageSize: number
              total: number
            }
          }
          columns={columns}
          renderCard={(row) => (
            <Link
              href={`/admin/services/${row.id}`}
              className="rounded-card flex items-center gap-3 bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{row.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  /services/{row.slug}
                </span>
              </span>
              <ContentStatusPills
                record={{
                  published: row.publishedAt ? true : null,
                  dirty: row.dirty,
                }}
              />
            </Link>
          )}
          empty="No services yet"
          emptyDescription="Each service added here gets a card on /services and its own page."
          emptyAction={
            canCreate ? (
              <Link href="/admin/services/new" className={LINK_PRIMARY}>
                <Plus aria-hidden />
                New service
              </Link>
            ) : null
          }
        />
      )}
    </>
  )
}
