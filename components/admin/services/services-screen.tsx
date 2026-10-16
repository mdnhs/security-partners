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
import { statusLabel } from "@/components/admin/editor/editor-layout"
import { PageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonClassName } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { ServiceListItem } from "@/lib/schemas/api/services"

type Row = ServiceListItem & Record<string, unknown>
const ch = columnsFor<Row>()

const columns = ch.columns([
  ch.accessor("title", {
    header: "Service",
    cell: (info) => (
      <Link
        href={`/admin/services/${info.row.original.id}`}
        className="font-medium hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  ch.accessor("slug", {
    header: "Address",
    enableSorting: false,
    cell: (info) => (
      <span className="text-muted-foreground">/services/{info.getValue()}</span>
    ),
  }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = statusLabel({
        published: row.original.publishedAt ? true : null,
        dirty: row.original.dirty,
      })
      return <Badge variant={s.variant}>{s.text}</Badge>
    },
  }),
  ch.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => (
      <span className="text-muted-foreground">
        {formatDateTime(info.getValue())}
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
                onClick={() => setReordering((v) => !v)}
                aria-pressed={reordering}
              >
                <ArrowUpDown aria-hidden />
                {reordering ? "Back to list" : "Change order"}
              </Button>
            ) : null}
            {canCreate ? (
              <Link href="/admin/services/new" className={buttonClassName({})}>
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
          renderCard={(row) => {
            const s = statusLabel({
              published: row.publishedAt ? true : null,
              dirty: row.dirty,
            })
            return (
              <Link
                href={`/admin/services/${row.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{row.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    /services/{row.slug}
                  </span>
                </span>
                <Badge variant={s.variant}>{s.text}</Badge>
              </Link>
            )
          }}
          empty="No services yet."
          emptyAction={
            canCreate ? (
              <Link
                href="/admin/services/new"
                className={buttonClassName({ size: "sm" })}
              >
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
