"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { useUrlFilters } from "@/components/admin/data-table/list-url"
import { FilterSelect } from "@/components/admin/filter-field"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { PageHeader } from "@/components/admin/page-header"
import { api, unwrap } from "@/lib/api-client"
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  type ApplicationListItem,
  type ApplicationStatus,
} from "@/lib/schemas/api/applications"
import type { Paginated } from "@/lib/schemas/api/list"

import {
  APPLICATION_STATUS_OPTIONS,
  APPLICATION_STATUS_TONE,
  applicationHref,
} from "./application-status"

type Row = ApplicationListItem & Record<string, unknown>
const ch = columnsFor<Row>()

function Status({ status }: { status: ApplicationStatus }) {
  return (
    <StatusPill tone={APPLICATION_STATUS_TONE[status]}>
      {APPLICATION_STATUS_LABELS[status]}
    </StatusPill>
  )
}

const columns = ch.columns([
  ch.accessor("name", {
    header: "Applicant",
    enableSorting: false,
    cell: (info) => (
      <Link
        href={applicationHref(info.row.original.id)}
        className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  ch.display({
    id: "job",
    header: "Role",
    cell: ({ row }) => row.original.job.title,
  }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => <Status status={row.original.status} />,
  }),
  ch.accessor("createdAt", {
    header: "Received",
    enableSorting: false,
    cell: (info) => (
      <span className="text-muted-foreground">
        <RelativeTime iso={info.getValue()} />
      </span>
    ),
  }),
]) as unknown as DataTableColumns<Row>

const isStatus = (value: string): value is ApplicationStatus =>
  (APPLICATION_STATUSES as readonly string[]).includes(value)

/** Careers › Applications: newest first, filtered by status and role (?status=&job=). */
export function ApplicationsScreen() {
  const [params, setParams] = useUrlFilters(["status", "job"] as const)
  const status = isStatus(params.status) ? params.status : undefined
  const job = params.job || undefined
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => unwrap(api.jobs.$get()),
  })
  const filters = { status, job }
  return (
    <>
      <PageHeader
        title="Applications"
        description="Applications sent from the job pages. CVs and answers are private: they are deleted after the retention period in Settings ▸ Careers."
      />
      <DataTable<Row>
        syncUrl
        label="Applications"
        queryKey={["applications", filters]}
        filterKey={status || job ? `${status ?? ""}|${job ?? ""}` : ""}
        filteredEmpty="No applications match these filters"
        searchPlaceholder="Search names, emails, phones and roles"
        toolbar={
          <>
            <FilterSelect
              id="applications-status"
              label="Status"
              value={status ?? ""}
              onChange={(value) => setParams({ status: value })}
              options={[
                { value: "", label: "Any status" },
                ...APPLICATION_STATUS_OPTIONS,
              ]}
            />
            <FilterSelect
              id="applications-job"
              label="Role"
              value={job ?? ""}
              onChange={(value) => setParams({ job: value })}
              options={[
                { value: "", label: "All roles" },
                ...(jobs.data?.items ?? []).map((j) => ({
                  value: j.id,
                  label: j.title,
                })),
              ]}
            />
          </>
        }
        fetchPage={async (p) =>
          (await unwrap(
            api.applications.$get({
              query: {
                page: String(p.page),
                pageSize: String(p.pageSize),
                q: p.q,
                status,
                job,
              },
            })
          )) as Paginated<Row>
        }
        columns={columns}
        renderCard={(row) => (
          <Link
            href={applicationHref(row.id)}
            className="rounded-card flex flex-col gap-2 bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="font-semibold">{row.name}</span>
              <Status status={row.status} />
            </span>
            <span className="text-xs text-muted-foreground">
              {row.job.title} · <RelativeTime iso={row.createdAt} />
            </span>
          </Link>
        )}
        empty="No applications yet"
        emptyDescription="Applications appear here when someone applies on a job page."
      />
    </>
  )
}
