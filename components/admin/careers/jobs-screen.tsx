"use client"

import Link from "next/link"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { ContentStatusPills } from "@/components/admin/kit/content-status"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { PageHeader } from "@/components/admin/page-header"
import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"
import type { JobListItem } from "@/lib/schemas/api/jobs"

import { NewJobDialog } from "./new-job-dialog"

type Row = JobListItem & Record<string, unknown>
const ch = columnsFor<Row>()

const jobHref = (id: string) => `/admin/careers/jobs/${id}`

/** Open / Closed of the live version; nothing before the first publish. */
function OpenPill({ open }: { open: boolean | null }) {
  if (open === null) return null
  return (
    <StatusPill tone={open ? "success" : "neutral"}>
      {open ? "Open" : "Closed"}
    </StatusPill>
  )
}

const columns = ch.columns([
  ch.accessor("title", {
    header: "Job",
    enableSorting: false,
    cell: (info) => (
      <Link
        href={jobHref(info.row.original.id)}
        className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  ch.accessor("category", { header: "Category", enableSorting: false }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1.5">
        <ContentStatusPills
          record={{
            published: row.original.publishedAt ? true : null,
            dirty: row.original.dirty,
          }}
        />
        <OpenPill open={row.original.open} />
      </span>
    ),
  }),
  ch.accessor("closingDate", {
    header: "Closes",
    enableSorting: false,
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  ch.accessor("updatedAt", {
    header: "Updated",
    enableSorting: false,
    cell: (info) => (
      <span className="text-muted-foreground">
        <RelativeTime iso={info.getValue()} />
      </span>
    ),
  }),
]) as unknown as DataTableColumns<Row>

/** Careers › Jobs: every opening, open or closed; new job. */
export function JobsScreen() {
  const canCreate = usePermission({ job: ["create"] })
  return (
    <>
      <PageHeader
        title="Jobs"
        description="Openings listed on /careers. A role closes after its closing date or when marked filled, then shows under Previous Openings."
        actions={canCreate ? <NewJobDialog /> : null}
      />
      <DataTable<Row>
        label="Jobs"
        queryKey={["jobs"]}
        searchPlaceholder="Search titles and categories"
        fetchPage={async (params) => {
          const { items } = await unwrap(api.jobs.$get())
          const q = params.q?.trim().toLowerCase()
          const matched = (items as Row[]).filter(
            (j) =>
              !q ||
              j.title.toLowerCase().includes(q) ||
              j.category.toLowerCase().includes(q)
          )
          const start = (params.page - 1) * params.pageSize
          return {
            items: matched.slice(start, start + params.pageSize),
            page: params.page,
            pageSize: params.pageSize,
            total: matched.length,
          }
        }}
        columns={columns}
        renderCard={(row) => (
          <Link
            href={jobHref(row.id)}
            className="rounded-card flex flex-col gap-2 bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="font-semibold">{row.title}</span>
            <span className="flex flex-wrap gap-1.5">
              <ContentStatusPills
                record={{
                  published: row.publishedAt ? true : null,
                  dirty: row.dirty,
                }}
              />
              <OpenPill open={row.open} />
            </span>
            <span className="text-xs text-muted-foreground">
              {row.category} · closes {row.closingDate}
            </span>
          </Link>
        )}
        empty="No jobs yet"
        emptyDescription="Each job added here gets a card on /careers and its own page with an application form."
        emptyAction={canCreate ? <NewJobDialog /> : null}
      />
    </>
  )
}
