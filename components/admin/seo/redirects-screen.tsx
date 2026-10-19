"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Upload } from "lucide-react"
import { createContext, useContext, useState } from "react"
import { toast } from "sonner"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { formatNumber } from "@/components/admin/kit/format"
import { CsvDownloadButton } from "@/components/admin/leads/csv-download-button"
import { RelativeTime } from "@/components/admin/kit/relative-time"
import { StatusPill } from "@/components/admin/kit/status-pill"
import {
  FORM_ACTION,
  PageHeader,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
} from "@/components/admin/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { Paginated } from "@/lib/schemas/api/list"
import type { RedirectCode, RedirectDto } from "@/lib/schemas/api/redirects"
import { cn } from "@/lib/utils"

import { RedirectDialog } from "./redirect-dialog"
import { RedirectImportDialog } from "./redirect-import-dialog"

const EXPORT_HREF = "/api/v1/admin/redirects/export.csv"

type Row = RedirectDto & Record<string, unknown>
const ch = columnsFor<Row>()
const QUERY_KEY = ["redirects"] as const

type Actions = {
  canUpdate: boolean
  canDelete: boolean
  onEdit: (row: RedirectDto) => void
  onDelete: (row: RedirectDto) => void
  onToggle: (row: RedirectDto) => void
  /** Ids of every redirect whose On/Off change is in flight. */
  toggling: ReadonlySet<string>
}

/**
 * aria-disabled instead of disabled: a pressed toggle keeps keyboard focus
 * while its request runs (WCAG 2.4.3); onToggle ignores in-flight rows.
 */
const SOFT_DISABLED =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:translate-y-0"
const ActionsContext = createContext<Actions | null>(null)

const PERMANENT = new Set<RedirectCode>([301, 308])

function TypePill({ code }: { code: RedirectCode }) {
  const permanent = PERMANENT.has(code)
  return (
    <StatusPill tone={permanent ? "success" : "info"}>
      {permanent ? `Permanent (${code})` : `Temporary (${code})`}
    </StatusPill>
  )
}

/** On/Off as text (never colour alone). */
function ActivePill({ active }: { active: boolean }) {
  return (
    <StatusPill tone={active ? "success" : "neutral"}>
      {active ? "On" : "Off"}
    </StatusPill>
  )
}

function AutomaticBadge({ source }: { source: RedirectDto["source"] }) {
  if (source !== "auto") return null
  return (
    <Badge
      variant="outline"
      title="Added when a published page was renamed or deleted"
    >
      Automatic
    </Badge>
  )
}

function LastHit({ iso }: { iso: string | null }) {
  return (
    <span className="text-muted-foreground">
      {iso ? <RelativeTime iso={iso} /> : "Never"}
    </span>
  )
}

function FromCell({ row }: { row: RedirectDto }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-xs">{row.fromPath}</code>
        <AutomaticBadge source={row.source} />
      </div>
      {row.note ? (
        <span className="text-xs break-words text-muted-foreground">
          {row.note}
        </span>
      ) : null}
    </div>
  )
}

function RowActions({ row }: { row: RedirectDto }) {
  const actions = useContext(ActionsContext)!
  if (!actions.canUpdate && !actions.canDelete) return null
  return (
    <div className="flex justify-end gap-2">
      {actions.canUpdate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("pointer-coarse:h-11", SOFT_DISABLED)}
          aria-label={`${row.isActive ? "Turn off" : "Turn on"} redirect from ${row.fromPath}`}
          aria-disabled={actions.toggling.has(row.id) || undefined}
          onClick={() => actions.onToggle(row)}
        >
          {row.isActive ? "Turn off" : "Turn on"}
        </Button>
      ) : null}
      {actions.canUpdate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:h-11"
          aria-label={`Edit redirect from ${row.fromPath}`}
          onClick={() => actions.onEdit(row)}
        >
          Edit
        </Button>
      ) : null}
      {actions.canDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="pointer-coarse:h-11"
          aria-label={`Delete redirect from ${row.fromPath}`}
          onClick={() => actions.onDelete(row)}
        >
          Delete
        </Button>
      ) : null}
    </div>
  )
}

const columns = ch.columns([
  ch.accessor("fromPath", {
    header: "From",
    cell: ({ row }) => <FromCell row={row.original} />,
  }),
  ch.accessor("toPath", {
    header: "To",
    enableSorting: false,
    cell: (info) => (
      <code className="font-mono text-xs break-all text-muted-foreground">
        {info.getValue()}
      </code>
    ),
  }),
  ch.accessor("code", {
    header: "Type",
    enableSorting: false,
    cell: (info) => <TypePill code={info.getValue()} />,
  }),
  ch.accessor("isActive", {
    header: "Status",
    enableSorting: false,
    cell: (info) => <ActivePill active={info.getValue()} />,
  }),
  ch.accessor("hits", {
    header: "Hits",
    cell: (info) => (
      <span className="tabular-nums">{formatNumber(info.getValue())}</span>
    ),
  }),
  ch.accessor("lastHitAt", {
    header: "Last hit",
    enableSorting: false,
    // "Now" is the list's fetch time (DataTable's NowProvider).
    cell: (info) => <LastHit iso={info.getValue()} />,
  }),
  ch.accessor("updatedAt", {
    header: "Updated",
    // "Now" is the list's fetch time (DataTable's NowProvider).
    cell: (info) => (
      <span className="text-muted-foreground">
        <RelativeTime iso={info.getValue()} />
      </span>
    ),
  }),
  ch.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row.original} />,
  }),
]) as unknown as DataTableColumns<Row>

/** SEO › Redirects (master 8.2): list, add, edit, delete; hits per redirect. */
export function RedirectsScreen() {
  const canRead = usePermission({ redirect: ["read"] })
  const canCreate = usePermission({ redirect: ["create"] })
  const canUpdate = usePermission({ redirect: ["update"] })
  const canDelete = usePermission({ redirect: ["delete"] })
  // The import route needs both (it adds and changes redirects).
  const canImport = canCreate && canUpdate
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<RedirectDto | "new" | null>(null)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState<RedirectDto | null>(null)
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  const remove = useMutation({
    mutationFn: (row: RedirectDto) =>
      unwrap(api.redirects[":id"].$delete({ param: { id: row.id } })),
    onSuccess: (_, row) => {
      toast.success(`Redirect from ${row.fromPath} deleted`)
      setDeleting(null)
      refresh()
    },
    onError: (error) =>
      toast.error("Not deleted", { description: errorMessage(error) }),
  })
  // useMutation keeps only the latest variables: track every row in flight.
  const [toggling, setToggling] = useState<ReadonlySet<string>>(new Set())
  const setInFlight = (id: string, on: boolean) =>
    setToggling((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const toggle = useMutation({
    onMutate: (row: RedirectDto) => setInFlight(row.id, true),
    onSettled: (_data, _error, row) => setInFlight(row.id, false),
    mutationFn: (row: RedirectDto) =>
      unwrap(
        api.redirects[":id"].$patch({
          param: { id: row.id },
          json: { isActive: !row.isActive },
        })
      ),
    onSuccess: (_, row) => {
      toast.success(
        `Redirect from ${row.fromPath} turned ${row.isActive ? "off" : "on"}`
      )
      refresh()
    },
    onError: (error, row) =>
      toast.error(row.isActive ? "Not turned off" : "Not turned on", {
        description: errorMessage(error),
      }),
  })
  const addButton = (className: string) =>
    canCreate ? (
      <Button className={className} onClick={() => setEditing("new")}>
        <Plus aria-hidden data-icon="inline-start" />
        Add redirect
      </Button>
    ) : undefined

  return (
    <ActionsContext.Provider
      value={{
        canUpdate,
        canDelete,
        onEdit: setEditing,
        onDelete: setDeleting,
        onToggle: (row) => {
          if (!toggling.has(row.id)) toggle.mutate(row)
        },
        toggling,
      }}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Redirects"
          description="Send old addresses to their new home. Renamed or deleted services and articles are redirected automatically, marked Automatic."
          actions={
            <>
              {canRead ? (
                <CsvDownloadButton href={EXPORT_HREF}>
                  Export CSV
                </CsvDownloadButton>
              ) : null}
              {canImport ? (
                <Button
                  type="button"
                  variant="outline"
                  className={SECONDARY_ACTION}
                  onClick={() => setImporting(true)}
                >
                  <Upload aria-hidden data-icon="inline-start" />
                  Import CSV
                </Button>
              ) : null}
              {addButton(PRIMARY_ACTION)}
            </>
          }
        />
        <DataTable<Row>
          syncUrl
          label="Redirects"
          queryKey={QUERY_KEY}
          fetchPage={async (params) =>
            (await unwrap(
              api.redirects.$get({
                query: {
                  page: String(params.page),
                  pageSize: String(params.pageSize),
                  sort: params.sort,
                  q: params.q,
                },
              })
            )) as Paginated<Row>
          }
          columns={columns}
          initialSort={[{ id: "updatedAt", desc: true }]}
          searchPlaceholder="Search addresses"
          renderCard={(row) => (
            <div className="rounded-card flex flex-col gap-2 bg-card p-4">
              <FromCell row={row} />
              <code className="font-mono text-xs break-all text-muted-foreground">
                → {row.toPath}
              </code>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <ActivePill active={row.isActive} />
                <TypePill code={row.code} />
                <span className="tabular-nums">
                  {formatNumber(row.hits)} hits
                </span>
                <span className="text-muted-foreground">
                  Last hit <LastHit iso={row.lastHitAt} />
                </span>
              </div>
              <RowActions row={row} />
            </div>
          )}
          empty="No redirects yet. Add one when a page moves; renaming a published service or article adds one for you."
          emptyAction={addButton(FORM_ACTION)}
        />
      </div>
      {editing ? (
        <RedirectDialog
          key={editing === "new" ? "new" : editing.id}
          redirect={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
      {importing ? (
        <RedirectImportDialog
          onClose={() => setImporting(false)}
          onImported={refresh}
        />
      ) : null}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this redirect?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `Visitors to ${deleting.fromPath} will see “page not found”.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ActionsContext.Provider>
  )
}
