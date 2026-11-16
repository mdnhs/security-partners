"use client"

import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { type FormEvent, useId, useMemo, useState } from "react"

import { EmptyState } from "@/components/admin/kit/empty-state"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import {
  FORM_ACTION,
  PageHeader,
  PRIMARY_ACTION,
} from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { SeoEntry, SeoKind } from "@/lib/schemas/api/seo"
import { cn } from "@/lib/utils"

import { SEO_OVERVIEW_KEY } from "./keys"
import { PreferredAddressCard } from "./preferred-address-card"
import { useSaveSeo } from "./use-save-seo"

const KIND_LABEL: Record<SeoKind, string> = {
  page: "Page",
  service: "Service",
  article: "Article",
  builder: "Custom page",
}

type Filter = "all" | "custom"

/** The address search engines are told to index: the override, else the page. */
export function canonicalOf(entry: SeoEntry, origin: string): string {
  return (
    entry.seo.canonical || `${origin}${entry.path === "/" ? "/" : entry.path}`
  )
}

/**
 * SEO › Canonical URLs: every page, service, article and custom page with
 * the canonical address its <head> sends. A record points at itself unless
 * it names another address (the main copy lives elsewhere); set or clear
 * that here. Saves are live, like the SEO sheet.
 */
export function CanonicalScreen({ origin }: { origin: string }) {
  const canUpdate = usePermission({ seo: ["update"] })
  const overview = useQuery({
    queryKey: SEO_OVERVIEW_KEY,
    queryFn: () => unwrap(api.seo.overview.$get()),
  })
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [editing, setEditing] = useState<SeoEntry | null>(null)
  const searchId = useId()

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (overview.data?.entries ?? []).filter(
      (e) =>
        (filter === "all" || Boolean(e.seo.canonical)) &&
        (!needle ||
          e.name.toLowerCase().includes(needle) ||
          e.path.toLowerCase().includes(needle) ||
          (e.seo.canonical ?? "").toLowerCase().includes(needle))
    )
  }, [overview.data, query, filter])
  const customCount = (overview.data?.entries ?? []).filter(
    (e) => e.seo.canonical
  ).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Canonical URLs"
        description="The site's main address, and the address each page tells search engines to index. Every page points at itself unless its main copy lives at another address; set that here."
      />
      <PreferredAddressCard />
      {overview.isPending ? (
        <CardSkeleton />
      ) : overview.isError ? (
        <EmptyState
          role="alert"
          title="Canonical URLs didn't load"
          description={errorMessage(overview.error)}
          action={
            <Button
              className={PRIMARY_ACTION}
              onClick={() => void overview.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Label htmlFor={searchId} className="sr-only">
                Search pages
              </Label>
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages"
                className="pl-9"
              />
            </div>
            <div
              role="group"
              aria-label="Show"
              className="flex rounded-xl bg-muted p-1 ring-1 ring-border"
            >
              {(
                [
                  ["all", `All (${overview.data.entries.length})`],
                  ["custom", `Custom (${customCount})`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "h-8 rounded-lg px-3 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11",
                    filter === value &&
                      "bg-background font-semibold text-foreground shadow-sm ring-1 ring-border dark:bg-sidebar-accent"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title={
                filter === "custom" && !query
                  ? "Every page points at itself"
                  : "No pages match"
              }
              description={
                filter === "custom" && !query
                  ? "That is the normal setup. Set a custom canonical only when a page's main copy lives at another address."
                  : "Try another search."
              }
            />
          ) : (
            <ul
              aria-label="Pages and their canonical URLs"
              className="rounded-card flex flex-col divide-y overflow-hidden border bg-card"
            >
              {rows.map((entry) => (
                <CanonicalRow
                  key={`${entry.kind}:${entry.id}`}
                  entry={entry}
                  origin={origin}
                  canUpdate={canUpdate}
                  onEdit={() => setEditing(entry)}
                />
              ))}
            </ul>
          )}
        </>
      )}
      {editing ? (
        <CanonicalDialog
          entry={editing}
          origin={origin}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function CanonicalRow({
  entry,
  origin,
  canUpdate,
  onEdit,
}: {
  entry: SeoEntry
  origin: string
  canUpdate: boolean
  onEdit: () => void
}) {
  const custom = Boolean(entry.seo.canonical)
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{entry.name}</span>
          <span className="text-xs text-muted-foreground">
            {KIND_LABEL[entry.kind]}
          </span>
          {!entry.published ? (
            <StatusPill tone="neutral">Not published</StatusPill>
          ) : null}
          {entry.seo.noindex ? (
            <StatusPill tone="warning">Hidden from search</StatusPill>
          ) : null}
        </div>
        <code className="font-mono text-xs break-all text-muted-foreground">
          {entry.path}
        </code>
      </div>
      <div className="flex min-w-0 flex-col gap-1 sm:w-[45%]">
        <div className="flex items-center gap-2">
          <StatusPill tone={custom ? "info" : "success"}>
            {custom ? "Custom" : "Self"}
          </StatusPill>
        </div>
        <code className="font-mono text-xs break-all">
          {canonicalOf(entry, origin)}
        </code>
      </div>
      {canUpdate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start sm:self-center pointer-coarse:h-11"
          aria-label={`Edit canonical URL of ${entry.name}`}
          onClick={onEdit}
        >
          Edit
        </Button>
      ) : null}
    </li>
  )
}

function CanonicalDialog({
  entry,
  origin,
  onClose,
}: {
  entry: SeoEntry
  origin: string
  onClose: () => void
}) {
  const save = useSaveSeo(entry.kind, entry.id)
  const [value, setValue] = useState(entry.seo.canonical ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inputId = useId()
  const self = `${origin}${entry.path === "/" ? "/" : entry.path}`

  async function submit(canonical: string) {
    setPending(true)
    setError(null)
    try {
      // The whole seo object is saved: keep every other field as it is.
      const rest = { ...entry.seo }
      delete rest.canonical
      await save(
        canonical.trim() ? { ...rest, canonical: canonical.trim() } : rest
      )
      onClose()
    } catch (err) {
      setError(
        (err instanceof ApiError && err.fieldErrors.canonical?.[0]) ||
          errorMessage(err)
      )
    } finally {
      setPending(false)
    }
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(value)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => (!open && !pending ? onClose() : null)}
    >
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Canonical URL: {entry.name}</DialogTitle>
            <DialogDescription>
              Leave empty so the page points at itself ({self}). Set another
              address only when the main copy of this content lives there.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>Canonical address</Label>
            <Input
              id={inputId}
              type="url"
              inputMode="url"
              value={value}
              placeholder={self}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              autoFocus
            />
            {error ? (
              <p
                id={`${inputId}-error`}
                className="text-sm font-medium text-destructive"
              >
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            {entry.seo.canonical ? (
              <Button
                type="button"
                variant="outline"
                className={cn(FORM_ACTION, "sm:mr-auto")}
                disabled={pending}
                onClick={() => void submit("")}
              >
                Use the page itself
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className={FORM_ACTION} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
