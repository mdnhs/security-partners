"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { SquareKanban, Table2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
  useState,
} from "react"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { FilterSelect } from "@/components/admin/filter-field"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { FORM_ACTION, PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePermission } from "@/hooks/use-permission"
import {
  type LeadInboxFilters,
  leadExportHref,
  leadFilterQuery,
} from "@/lib/admin/leads"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type LeadAssignee,
  type LeadDto,
  type LeadListItem,
  type LeadStatus,
} from "@/lib/schemas/api/leads"

import { CsvDownloadButton } from "./csv-download-button"
import { leadKey } from "./lead-detail"
import { LeadDrawer } from "./lead-drawer"
import { LeadsBoard } from "./leads-board"
import { LeadStatusBadge } from "./lead-status-badge"
import {
  type LeadsFolder,
  type LeadsParams,
  useLeadsParams,
} from "./use-leads-params"

type Row = LeadListItem & Record<string, unknown>
const ch = columnsFor<Row>()

/** Opens a lead in the drawer (module-scope columns read it from here). */
const OpenLeadContext = createContext<(id: string) => void>(() => {})

/** Where a lead opens: the inbox with its drawer (shareable, new tab). */
const leadHref = (id: string) => `/admin/leads?lead=${encodeURIComponent(id)}`

/**
 * The lead's name as a real link (new tab, copy link); a plain click opens
 * the drawer in place, keeping the list's filters.
 */
function LeadLink({
  lead,
  className,
}: {
  lead: Pick<LeadListItem, "id" | "name">
  className?: string
}) {
  const open = useContext(OpenLeadContext)
  return (
    <Link
      href={leadHref(lead.id)}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return
        event.preventDefault()
        open(lead.id)
      }}
    >
      {lead.name}
    </Link>
  )
}

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
        <LeadLink
          lead={info.row.original}
          className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        />
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

/** The board shows the latest enquiries only (one request, no paging). */
const BOARD_LIMIT = 100

/**
 * The inbox as a board (D3.3): the latest 100 enquiries that are open, won
 * or lost (the API's default "everything but spam"), newest first. A move
 * PATCHes the lead's status (lead:update, like the drawer's select) and
 * updates the board's cache with the saved lead; a failure rejects, so the
 * board puts the card back.
 */
function BoardView({
  assignee,
  toolbar,
  onOpen,
}: {
  assignee: string
  toolbar: ReactNode
  onOpen: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const canUpdate = usePermission({ lead: ["update"] })
  const key = ["leads", "board", assignee] as const
  const board = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await unwrap(
        api.leads.$get({
          query: {
            page: "1",
            pageSize: String(BOARD_LIMIT),
            ...(assignee ? { assignee } : {}),
          },
        })
      )) as Paginated<LeadListItem>,
  })

  // The PATCH has no version/If-Match: a move overwrites a concurrent status
  // change by another user (last write wins, the same as the drawer's
  // select; pre-existing and accepted). Moves are serialised per card, and
  // the board re-syncs from the response.
  const onMove = async (id: string, status: LeadStatus) => {
    // Earlier fetches must not overwrite the move.
    await queryClient.cancelQueries({ queryKey: key })
    let dto: LeadDto
    try {
      dto = (await unwrap(
        api.leads[":id"].$patch({ param: { id }, json: { status } })
      )) as LeadDto
    } catch (error) {
      // The cancelled refetch is not left undone: fetch the board again
      // (D3.3 review n5). The board puts the card back meanwhile.
      void queryClient.invalidateQueries({ queryKey: key })
      throw error
    }
    queryClient.setQueryData<Paginated<LeadListItem>>(key, (prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((lead) =>
              lead.id === id
                ? { ...lead, status: dto.status, assignee: dto.assignee }
                : lead
            ),
          }
        : prev
    )
    queryClient.setQueryData(leadKey(id), dto)
    // Other lists (table, other assignee boards) and the nav badge.
    void queryClient.invalidateQueries({
      queryKey: ["leads"],
      predicate: (q) =>
        q.queryKey[1] !== "detail" &&
        !(q.queryKey[1] === "board" && q.queryKey[2] === assignee),
    })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">{toolbar}</div>
      {board.isError ? (
        <EmptyState
          role="alert"
          title="The enquiries didn't load"
          description={errorMessage(board.error)}
          action={
            <Button
              type="button"
              className={FORM_ACTION}
              onClick={() => board.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : board.isPending ? (
        <div role="status">
          <span className="sr-only">Loading enquiries…</span>
          <CardSkeleton />
        </div>
      ) : (
        <>
          <LeadsBoard
            leads={board.data.items}
            canUpdate={canUpdate}
            onOpen={onOpen}
            onMove={onMove}
          />
          {board.data.total > board.data.items.length ? (
            <p className="text-sm text-muted-foreground">
              <span>Showing the latest {BOARD_LIMIT}</span>
              <span>
                {" "}
                of {board.data.total}. Use the table to see the rest.
              </span>
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

const FOLDERS: readonly { value: LeadsFolder; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "spam", label: "Spam" },
]

/** Toggle items: 40 px, 44 px on touch (WCAG 2.5.8 / coarse pointers). */
const VIEW_TOGGLE =
  "[&_[data-slot=toggle-group-item]]:h-10 [&_[data-slot=toggle-group-item]]:rounded-xl [&_[data-slot=toggle-group-item]]:px-3 [&_[data-slot=toggle-group-item]]:pointer-coarse:h-11"

/**
 * Leads (spec §8.1, MK parity D3.2): Inbox and Spam tabs, a Board/Table
 * toggle (board by default, D3.3), status and assignee filters, and a
 * side drawer per enquiry (`?lead=`). Folder, view, filters and the open
 * lead live in the URL, so links and reloads keep them; a CSV export takes
 * what the list shows.
 */
export function LeadsScreen() {
  const [params, setParams] = useLeadsParams()
  const filters: LeadInboxFilters = {
    status: params.status ?? "",
    assignee: params.assignee ?? "",
  }
  // The table's debounced search, as last sent to the API (for the export).
  const [search, setSearch] = useState("")
  const canExport = usePermission({ lead: ["export"] })
  const assignees = useQuery({
    queryKey: ["leads", "assignees"],
    queryFn: async () =>
      (await unwrap(api.leads.assignees.$get())).items as LeadAssignee[],
  })
  const query = leadFilterQuery(filters)
  const spam = params.folder === "spam"
  // Spam's own status is the folder, not a filter (empty-state wording).
  const filterKey =
    (!spam && filters.status) || filters.assignee
      ? `${filters.status}|${filters.assignee}`
      : ""
  const open = (id: string) => setParams({ lead: id })

  const assigneeFilter = (
    <FilterSelect
      id="leads-assignee"
      label="Assignee"
      value={filters.assignee}
      onChange={(value) => setParams({ assignee: value })}
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
  )
  const board = !spam && params.view === "board"

  const list = board ? (
    <BoardView
      assignee={filters.assignee}
      toolbar={assigneeFilter}
      onOpen={open}
    />
  ) : (
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
          {spam ? null : (
            <FilterSelect
              id="leads-status"
              label="Status"
              value={filters.status}
              onChange={(value) =>
                setParams({
                  status: (value || undefined) as LeadsParams["status"],
                })
              }
              options={[
                { value: "", label: "All but spam" },
                { value: "open", label: "Open" },
                ...LEAD_STATUSES.filter((s) => s !== "spam").map((s) => ({
                  value: s,
                  label: LEAD_STATUS_LABELS[s],
                })),
                // Older links (?status=all): kept while they are active.
                ...(filters.status === "all"
                  ? [{ value: "all", label: "Everything" }]
                  : []),
              ]}
            />
          )}
          {assigneeFilter}
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
      onRowClick={(lead) => open(lead.id)}
      renderCard={(lead) => (
        <div className="rounded-card relative flex flex-col gap-2 bg-card p-4">
          <span className="flex items-start justify-between gap-2">
            <LeadLink
              lead={lead}
              className="after:rounded-card min-w-0 truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            />
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
      empty={spam ? "No spam" : "No enquiries yet"}
      emptyDescription={
        spam
          ? "Enquiries marked as spam are kept here."
          : "They appear here when someone sends the contact form on the website."
      }
    />
  )

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Messages from the contact form."
        actions={
          canExport ? (
            <CsvDownloadButton
              href={
                // What the list shows: the board takes only the assignee
                // filter (no status, no search; D3.3 review n2).
                board
                  ? leadExportHref({ assignee: filters.assignee })
                  : leadExportHref({ ...query, q: search })
              }
            >
              Export CSV
            </CsvDownloadButton>
          ) : null
        }
      />
      <OpenLeadContext.Provider value={open}>
        <Tabs
          value={params.folder}
          onValueChange={(value) =>
            setParams({ folder: value === "spam" ? "spam" : "inbox" })
          }
          className="gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList aria-label="Folders">
              {FOLDERS.map((folder) => (
                <TabsTrigger key={folder.value} value={folder.value}>
                  {folder.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {/* Spam is always a table: the board only holds the inbox. */}
            {spam ? null : (
              <ToggleGroup
                aria-label="View"
                variant="outline"
                value={[params.view]}
                onValueChange={(next) => {
                  const value = next[0]
                  if (value === "board" || value === "table")
                    setParams({ view: value })
                }}
                className={VIEW_TOGGLE}
              >
                <ToggleGroupItem value="board">
                  <SquareKanban aria-hidden />
                  Board
                </ToggleGroupItem>
                <ToggleGroupItem value="table">
                  <Table2 aria-hidden />
                  Table
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          {FOLDERS.map((folder) => (
            <TabsContent
              key={folder.value}
              value={folder.value}
              className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {/* The inbox shows the board or the table; Spam a table. */}
              {folder.value === params.folder ? list : null}
            </TabsContent>
          ))}
        </Tabs>
      </OpenLeadContext.Provider>
      <LeadDrawer id={params.lead} onClose={() => setParams({ lead: null })} />
    </>
  )
}
