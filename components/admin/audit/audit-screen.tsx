"use client"

import { useState } from "react"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { FilterInput } from "@/components/admin/filter-field"
import { FORM_ACTION, PageHeader } from "@/components/admin/page-header"
import { UserPicker } from "@/components/admin/users/user-picker"
import { Button } from "@/components/ui/button"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { usePermission } from "@/hooks/use-permission"
import { describeActivity } from "@/lib/admin/activity"
import {
  AUDIT_ACTION_SUGGESTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditFilters,
  auditFilterQuery,
  EMPTY_AUDIT_FILTERS,
  hasAuditFilters,
} from "@/lib/admin/audit-filters"
import { api, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { actorLabel, AuditDetailSheet } from "./audit-detail-sheet"
import { ImpersonatorName } from "./impersonator-name"
import type { AuditItem } from "./types"

type Row = AuditItem & Record<string, unknown>

/** Row click target: the details button (44 px on touch screens). */
const DETAILS_BUTTON = "pointer-coarse:h-11 pointer-coarse:px-4"

/** Audit log (spec §8.1): filter by actor, action, record type and Irish dates. */
export function AuditScreen() {
  const canListUsers = usePermission({ user: ["read"] })
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS)
  const [open, setOpen] = useState<AuditItem | null>(null)
  // Typed filters wait for a pause; the picker and dates apply at once anyway.
  const applied = useDebouncedValue(filters, 250)
  const query = auditFilterQuery(applied)
  const filterKey = hasAuditFilters(applied) ? JSON.stringify(query) : ""

  const set = (key: keyof AuditFilters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }))

  // Columns close over setOpen (stable), so one definition per screen mount.
  const [columns] = useState(() => {
    const ch = columnsFor<Row>()
    return ch.columns([
      ch.accessor("createdAt", {
        header: "When",
        cell: (info) => (
          <time
            dateTime={info.getValue()}
            className="whitespace-nowrap text-muted-foreground tabular-nums"
          >
            {formatDateTime(info.getValue())}
          </time>
        ),
      }),
      ch.display({
        id: "actor",
        header: "Who",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{actorLabel(row.original)}</span>
            {row.original.impersonatorId ? (
              <span className="text-xs text-muted-foreground">
                viewed as by{" "}
                <ImpersonatorName id={row.original.impersonatorId} />
              </span>
            ) : null}
          </span>
        ),
      }),
      ch.accessor("action", {
        header: "Action",
        cell: (info) => (
          <span className="flex flex-col gap-0.5">
            <code className="font-mono text-xs">{info.getValue()}</code>
            {info.row.original.entityType ? (
              <span className="text-xs text-muted-foreground">
                {info.row.original.entityType}
              </span>
            ) : null}
          </span>
        ),
      }),
      ch.display({
        id: "what",
        header: "What",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {describeActivity(row.original).text}
          </span>
        ),
      }),
      ch.display({
        id: "details",
        header: () => <span className="sr-only">Details</span>,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={DETAILS_BUTTON}
            aria-label={`Details of ${row.original.action} at ${formatDateTime(row.original.createdAt)}`}
            onClick={() => setOpen(row.original)}
          >
            {isRecord(row.original.diff) &&
            "from" in row.original.diff &&
            "to" in row.original.diff
              ? "Changes"
              : "Details"}
          </Button>
        ),
      }),
    ]) as unknown as DataTableColumns<Row>
  })

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sign-ins, user changes and content changes, newest first. Times are Irish time."
      />
      <DataTable<Row>
        label="Audit log"
        queryKey={["audit", query]}
        filterKey={filterKey}
        filteredEmpty="Nothing matches these filters"
        searchPlaceholder="Search action, record or email"
        toolbar={
          <>
            {canListUsers ? (
              <UserPicker
                id="audit-actor"
                label="Who"
                value={filters.actor}
                onChange={(user) => set("actor")(user?.id ?? "")}
              />
            ) : null}
            <FilterInput
              id="audit-action"
              label="Action"
              value={filters.action}
              onChange={set("action")}
              suggestions={AUDIT_ACTION_SUGGESTIONS}
              placeholder="e.g. user.invite"
            />
            <FilterInput
              id="audit-entity"
              label="Record type"
              value={filters.entityType}
              onChange={set("entityType")}
              suggestions={AUDIT_ENTITY_TYPES}
              placeholder="e.g. page"
            />
            <FilterInput
              id="audit-from"
              label="From"
              type="date"
              value={filters.from}
              onChange={set("from")}
            />
            <FilterInput
              id="audit-to"
              label="To"
              type="date"
              value={filters.to}
              onChange={set("to")}
            />
            {hasAuditFilters(filters) ? (
              <Button
                type="button"
                variant="ghost"
                className={cn(FORM_ACTION, "px-4")}
                onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}
              >
                Clear filters
              </Button>
            ) : null}
          </>
        }
        fetchPage={async (params) =>
          (await unwrap(
            api.audit.$get({
              query: {
                page: String(params.page),
                pageSize: String(params.pageSize),
                sort: params.sort,
                q: params.q,
                ...query,
              },
            })
          )) as { items: Row[]; page: number; pageSize: number; total: number }
        }
        columns={columns}
        renderCard={(row) => (
          <button
            type="button"
            onClick={() => setOpen(row)}
            aria-label={`Details of ${row.action} at ${formatDateTime(row.createdAt)}`}
            className="rounded-card flex w-full flex-col gap-1 bg-card p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{actorLabel(row)}</span>
              <time
                dateTime={row.createdAt}
                className="text-xs text-muted-foreground"
              >
                {formatDateTime(row.createdAt)}
              </time>
            </span>
            <span className="text-sm text-muted-foreground">
              {describeActivity(row).text}
            </span>
            <code className="font-mono text-xs text-muted-foreground">
              {row.action}
            </code>
          </button>
        )}
        empty="Nothing has been recorded yet"
        emptyDescription="Sign-ins, invitations, role changes and publishing will show here."
      />
      <AuditDetailSheet
        entry={open}
        onOpenChange={(next) => !next && setOpen(null)}
      />
    </>
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
