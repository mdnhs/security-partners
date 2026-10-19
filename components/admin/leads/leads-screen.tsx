"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { mergeListSearch } from "@/components/admin/data-table/list-url"
import { FilterSelect } from "@/components/admin/filter-field"
import { PageHeader } from "@/components/admin/page-header"
import { usePermission } from "@/hooks/use-permission"
import {
  type LeadInboxFilters,
  leadExportHref,
  leadFilterQuery,
  parseLeadFilters,
} from "@/lib/admin/leads"
import { api, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type LeadAssignee,
  type LeadListItem,
} from "@/lib/schemas/api/leads"

import { CsvDownloadButton } from "./csv-download-button"
import { LeadStatusBadge } from "./lead-status-badge"

type Row = LeadListItem & Record<string, unknown>
const ch = columnsFor<Row>()

// Column definitions live at module scope (TanStack Table v9 needs stable references).
const columns = ch.columns([
  ch.accessor("createdAt", {
    header: "Received",
    cell: (info) => (
      <time
        dateTime={info.getValue()}
        className="whitespace-nowrap text-muted-foreground"
      >
        {formatDateTime(info.getValue())}
      </time>
    ),
  }),
  ch.accessor("name", {
    header: "Name",
    cell: (info) => (
      <span className="flex min-w-0 flex-col">
        <Link
          href={`/admin/leads/${info.row.original.id}`}
          className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {info.getValue()}
        </Link>
        <span className="text-xs text-muted-foreground">
          {info.row.original.email}
        </span>
      </span>
    ),
  }),
  ch.accessor("status", {
    header: "Status",
    cell: (info) => <LeadStatusBadge status={info.getValue()} />,
  }),
  ch.display({
    id: "assignee",
    header: "Assignee",
    cell: ({ row }) =>
      row.original.assignee ? (
        row.original.assignee.name
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      ),
  }),
  ch.display({
    id: "sourcePage",
    header: "Page",
    cell: ({ row }) =>
      row.original.sourcePage ? (
        <code className="font-mono text-xs text-muted-foreground">
          {row.original.sourcePage}
        </code>
      ) : (
        <span className="text-muted-foreground">
          <span aria-hidden>—</span>
          <span className="sr-only">Unknown</span>
        </span>
      ),
  }),
]) as unknown as DataTableColumns<Row>

/**
 * Leads inbox (spec §8.1): enquiries from the contact form, newest first,
 * with status and assignee filters (kept in ?status= / ?assignee=, so links
 * and reloads keep them) and a CSV export of what the list shows.
 */
export function LeadsScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const paramString = params.toString()
  const [filters, setFilters] = useState<LeadInboxFilters>(() =>
    parseLeadFilters(new URLSearchParams(paramString))
  )
  // Back/Forward (or a link) changed the URL: follow it (adjusted during
  // render, final review M9). Our own replace lands here too, unchanged.
  const [seenParams, setSeenParams] = useState(paramString)
  if (seenParams !== paramString) {
    setSeenParams(paramString)
    const fromUrl = parseLeadFilters(new URLSearchParams(paramString))
    if (
      fromUrl.status !== filters.status ||
      fromUrl.assignee !== filters.assignee
    )
      setFilters(fromUrl)
  }
  // The table's debounced search, as last sent to the API (for the export).
  const [search, setSearch] = useState("")
  const changeFilters = (patch: Partial<LeadInboxFilters>) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    // The table's search and sort stay in the URL; the page resets.
    const own = leadFilterQuery(next)
    const query = mergeListSearch(window.location.search, {
      status: own.status,
      assignee: own.assignee,
    })
    router.replace(`/admin/leads${query ? `?${query}` : ""}`, {
      scroll: false,
    })
  }
  const canExport = usePermission({ lead: ["export"] })
  const assignees = useQuery({
    queryKey: ["leads", "assignees"],
    queryFn: async () =>
      (await unwrap(api.leads.assignees.$get())).items as LeadAssignee[],
  })
  const query = leadFilterQuery(filters)
  const filterKey =
    filters.status || filters.assignee
      ? `${filters.status}|${filters.assignee}`
      : ""
  return (
    <>
      <PageHeader
        title="Leads"
        description="Enquiries sent through the website contact form. Spam is hidden unless you filter for it."
        actions={
          canExport ? (
            <CsvDownloadButton href={leadExportHref({ ...query, q: search })}>
              Export CSV
            </CsvDownloadButton>
          ) : null
        }
      />
      <DataTable<Row>
        syncUrl
        label="Leads"
        queryKey={["leads", query]}
        filterKey={filterKey}
        filteredEmpty="No enquiries match these filters"
        initialSort={[{ id: "createdAt", desc: true }]}
        searchPlaceholder="Search name, email, company or phone"
        toolbar={
          <>
            <FilterSelect
              id="leads-status"
              label="Status"
              value={filters.status}
              onChange={(value) =>
                changeFilters({ status: value as LeadInboxFilters["status"] })
              }
              options={[
                { value: "", label: "Inbox (all but spam)" },
                { value: "open", label: "Open" },
                ...LEAD_STATUSES.map((s) => ({
                  value: s,
                  label: LEAD_STATUS_LABELS[s],
                })),
                { value: "all", label: "Everything" },
              ]}
            />
            <FilterSelect
              id="leads-assignee"
              label="Assignee"
              value={filters.assignee}
              onChange={(value) => changeFilters({ assignee: value })}
              options={[
                { value: "", label: "Anyone" },
                { value: "me", label: "Me" },
                { value: "none", label: "Unassigned" },
                // A filtered-for user who can no longer take leads (link from an email).
                ...(filters.assignee &&
                filters.assignee !== "me" &&
                filters.assignee !== "none" &&
                !(assignees.data ?? []).some((u) => u.id === filters.assignee)
                  ? [{ value: filters.assignee, label: "Someone else" }]
                  : []),
                ...(assignees.data ?? []).map((u) => ({
                  value: u.id,
                  label: u.name,
                })),
              ]}
            />
          </>
        }
        fetchPage={async (p) => {
          setSearch(p.q ?? "")
          return (await unwrap(
            api.leads.$get({
              query: {
                page: String(p.page),
                pageSize: String(p.pageSize),
                sort: p.sort,
                q: p.q,
                ...(query as Record<string, string>),
              },
            })
          )) as Paginated<Row>
        }}
        columns={columns}
        renderCard={(lead) => (
          <div className="rounded-card relative flex flex-col gap-2 bg-card p-4">
            <span className="flex items-start justify-between gap-2">
              <Link
                href={`/admin/leads/${lead.id}`}
                className="after:rounded-card min-w-0 truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                {lead.name}
              </Link>
              <LeadStatusBadge status={lead.status} />
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {lead.email}
            </span>
            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{lead.assignee?.name ?? "Unassigned"}</span>
              <time dateTime={lead.createdAt}>
                {formatDateTime(lead.createdAt)}
              </time>
            </span>
          </div>
        )}
        empty="No enquiries yet"
        emptyDescription="They appear here when someone sends the contact form on the website."
      />
    </>
  )
}
