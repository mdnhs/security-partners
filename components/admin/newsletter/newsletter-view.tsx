"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { CsvDownloadButton } from "@/components/admin/leads/csv-download-button"
import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { mergeListSearch } from "@/components/admin/data-table/list-url"
import { StatusPill, type StatusTone } from "@/components/admin/kit/status-pill"
import { PageHeader } from "@/components/admin/page-header"
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
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import {
  exportPermission,
  type NewsletterExportStatus,
} from "@/lib/newsletter/export"
import { cn } from "@/lib/utils"
import type { Paginated } from "@/lib/schemas/api/list"
import type {
  NewsletterStatus,
  SubscriberDto,
} from "@/lib/schemas/api/newsletter"
import type { NewsletterPlacement } from "@/lib/schemas/settings/newsletter"

type Row = SubscriberDto & Record<string, unknown>
const ch = columnsFor<Row>()

const PAGE_SIZE = 25
const TABS = ["confirmed", "pending", "unsubscribed", "all"] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  unsubscribed: "Unsubscribed",
  all: "All",
}
/** What an empty tab says. */
const TAB_EMPTY: Record<Tab, string> = {
  confirmed: "Nobody has confirmed yet",
  pending: "Nobody is waiting to confirm",
  unsubscribed: "Nobody has unsubscribed",
  all: "No subscribers yet",
}
/** 44 px on touch: these sit in phone cards, where they are tapped. */
const TOUCH_TARGET = "pointer-coarse:h-11 pointer-coarse:min-w-11"

const parseTab = (value: string | null): Tab =>
  TABS.includes(value as Tab) ? (value as Tab) : "confirmed"

const STATUS_TONE: Record<NewsletterStatus, StatusTone> = {
  confirmed: "success",
  pending: "warning",
  unsubscribed: "neutral",
}
const STATUS_LABEL: Record<NewsletterStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  unsubscribed: "Unsubscribed",
}

function SubscriberStatus({ status }: { status: NewsletterStatus }) {
  return (
    <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusPill>
  )
}

/** confirmedAt ?? createdAt: when the person joined (or signed up, if pending). */
const subscribedAt = (row: SubscriberDto) => row.confirmedAt ?? row.createdAt

function Subscribed({ row }: { row: SubscriberDto }) {
  const iso = subscribedAt(row)
  return (
    <time dateTime={iso} className="whitespace-nowrap text-muted-foreground">
      {formatDateTime(iso)}
    </time>
  )
}

function columnsWith(
  onDelete: ((row: SubscriberDto) => void) | null
): DataTableColumns<Row> {
  return ch.columns([
    ch.display({
      id: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="font-medium break-all">{row.original.email}</span>
      ),
    }),
    ch.display({
      id: "status",
      header: "Status",
      cell: ({ row }) => <SubscriberStatus status={row.original.status} />,
    }),
    ch.display({
      id: "source",
      header: "Source",
      cell: ({ row }) => (
        <code className="font-mono text-xs text-muted-foreground">
          {row.original.sourcePath}
        </code>
      ),
    }),
    ch.display({
      id: "subscribed",
      header: "Subscribed",
      cell: ({ row }) => <Subscribed row={row.original} />,
    }),
    ...(onDelete
      ? [
          ch.display({
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={TOUCH_TARGET}
                aria-label={`Delete ${row.original.email}`}
                onClick={() => onDelete(row.original)}
              >
                Delete
              </Button>
            ),
          }),
        ]
      : []),
  ]) as unknown as DataTableColumns<Row>
}

function exportHref(status: NewsletterExportStatus): string {
  return `/api/v1/admin/newsletter/export.csv?status=${status}`
}

/**
 * Newsletter subscribers (spec §7.4): Confirmed / Pending / Unsubscribed /
 * All tabs in ?tab=, a search, 25 per page, CSV export and delete. Export
 * is confirmed addresses only, except on the All tab for those who may
 * export everything (owner, admin: the API's newsletter export+delete rule).
 */
export function NewsletterView({
  placement,
}: {
  /** Published settings.newsletter.placement; null when unpublished. */
  placement: NewsletterPlacement | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const urlTab = parseTab(params.get("tab"))
  const [tab, setTab] = useState<Tab>(urlTab)
  // Back/Forward (or a link) changed ?tab=: follow it (adjusted during
  // render, as the leads inbox does). Our own replace lands here unchanged.
  const [seenTab, setSeenTab] = useState(urlTab)
  if (seenTab !== urlTab) {
    setSeenTab(urlTab)
    if (urlTab !== tab) setTab(urlTab)
  }
  // The last subscriber asked about stays while the dialog animates closed.
  const [removing, setRemoving] = useState<SubscriberDto | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const askDelete = (row: SubscriberDto) => {
    setRemoving(row)
    setConfirmOpen(true)
  }
  const canExport = usePermission(exportPermission("confirmed"))
  const canExportAll = usePermission(exportPermission("all"))
  const canDelete = usePermission({ newsletter: ["delete"] })

  const changeTab = (next: Tab) => {
    setTab(next)
    // The table's search stays; the page resets.
    const query = mergeListSearch(window.location.search, {
      tab: next === "confirmed" ? undefined : next,
    })
    router.replace(`/admin/newsletter${query ? `?${query}` : ""}`, {
      scroll: false,
    })
  }

  const status = tab === "all" ? undefined : tab
  const placementOff = placement === null || placement === "off"
  const placementHint =
    "The signup form is not on the website. Turn on a placement in Site settings › Newsletter."
  const emptyDescription: Record<Tab, string> = {
    confirmed: placementOff
      ? placementHint
      : "People appear here once they confirm their address.",
    pending: "Sign-ups waiting for the person to click the confirmation link.",
    unsubscribed: "People who used the unsubscribe link.",
    all: placementOff
      ? placementHint
      : "People who sign up on the website appear here.",
  }

  // Stable between renders (TanStack Table v9); only the delete column varies.
  const columns = useMemo(
    () => columnsWith(canDelete ? askDelete : null),
    [canDelete]
  )

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="People who signed up for the newsletter."
        actions={
          canExport ? (
            <CsvDownloadButton
              href={exportHref(
                tab === "all" && canExportAll ? "all" : "confirmed"
              )}
            >
              Export CSV
            </CsvDownloadButton>
          ) : null
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) => changeTab(parseTab(String(value)))}
        className="gap-4"
      >
        {/* Four labels can outgrow a 320 px phone: scroll, never the page. */}
        <TabsList
          aria-label="Subscriber status"
          className="max-w-full justify-start overflow-x-auto"
        >
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {TAB_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* One panel, the active tab's: the list it filters. */}
        <TabsContent value={tab}>
          <DataTable<Row>
            syncUrl
            label="Subscribers"
            queryKey={["newsletter", { status }]}
            filterKey={tab}
            filteredEmpty={TAB_EMPTY[tab]}
            filteredEmptyDescription={emptyDescription[tab]}
            pageSize={PAGE_SIZE}
            searchDebounceMs={300}
            searchPlaceholder="Search email addresses"
            fetchPage={async (p) =>
              (await unwrap(
                api.newsletter.$get({
                  query: {
                    page: String(p.page),
                    pageSize: String(p.pageSize),
                    q: p.q,
                    status,
                  },
                })
              )) as Paginated<Row>
            }
            columns={columns}
            renderCard={(row) => (
              <div className="rounded-card flex flex-col gap-2 bg-card p-4">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-semibold break-all">
                    {row.email}
                  </span>
                  <SubscriberStatus status={row.status} />
                </span>
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <code className="font-mono">{row.sourcePath}</code>
                  <Subscribed row={row} />
                </span>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("self-start", TOUCH_TARGET)}
                    aria-label={`Delete ${row.email}`}
                    onClick={() => askDelete(row)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            )}
            empty={TAB_EMPTY[tab]}
            emptyDescription={emptyDescription[tab]}
          />
        </TabsContent>
      </Tabs>
      <DeleteSubscriberDialog
        subscriber={removing}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  )
}

function DeleteSubscriberDialog({
  subscriber,
  open,
  onClose,
}: {
  subscriber: SubscriberDto | null
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async (id: string) =>
      unwrap(api.newsletter[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      onClose()
      toast.success("Subscriber deleted")
      void queryClient.invalidateQueries({ queryKey: ["newsletter"] })
    },
    onError: (error) => {
      onClose()
      toast.error("Not deleted", { description: errorMessage(error) })
    },
  })
  return (
    <AlertDialog
      open={open && subscriber !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this subscriber?</AlertDialogTitle>
          <AlertDialogDescription>
            {subscriber?.email} is removed from the newsletter list. This cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => subscriber && remove.mutate(subscriber.id)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
