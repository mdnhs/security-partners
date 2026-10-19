"use client"

import { useState } from "react"

import { useGuardedClose } from "@/components/admin/editor/discard-changes"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { PRIMARY_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermission } from "@/hooks/use-permission"
import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"

import { SeoPanel } from "./seo-panel"
import { useSaveSeo } from "./use-save-seo"

/** Why the sheet has no record to show yet (?edit= set). */
export type SeoSheetPending = "loading" | "error" | "missing"

/**
 * One record's SEO fields in a right sheet (JW detail pattern); saves are
 * live. Before the record is ready it says so (loading, failed with Try
 * again, or not found), never an empty sheet or no sheet at all. One sheet
 * across those states: it keeps the element to return focus to on close.
 */
export function SeoSheet({
  entry,
  pending = "loading",
  error,
  onRetry,
  origin,
  defaults,
  onClose,
}: {
  /** The record; null while it loads, failed or is unknown (`pending`). */
  entry: SeoEntry | null
  pending?: SeoSheetPending
  error?: string
  onRetry?: () => void
  origin: string
  /** SeoOverviewDto.defaults (site share image, robots mode). */
  defaults?: SeoOverviewDto["defaults"]
  onClose: () => void
}) {
  const [dirty, setDirty] = useState(false)
  const close = useGuardedClose({
    dirty: entry !== null && dirty,
    onClose,
    title: "Discard your SEO changes?",
    description: `The changes to ${entry?.name ?? "this record"} are not saved. The live page keeps its current settings.`,
  })
  const loading = entry === null && pending === "loading"
  return (
    // Esc, the close button or a click outside: never drop edits silently.
    <Sheet open onOpenChange={close.onOpenChange}>
      <SheetContent
        aria-busy={loading || undefined}
        className="w-full overflow-y-auto bg-card sm:max-w-xl"
      >
        {/* Inside the sheet's popup: a nested dialog (Esc closes it only). */}
        {close.guard}
        {entry ? (
          <SeoSheetBody
            key={`${entry.kind}:${entry.id}`}
            entry={entry}
            origin={origin}
            defaults={defaults}
            onDirtyChange={setDirty}
            onClose={onClose}
          />
        ) : (
          <SeoSheetPlaceholder
            state={pending}
            error={error}
            onRetry={onRetry}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function SeoSheetPlaceholder({
  state,
  error,
  onRetry,
}: {
  state: SeoSheetPending
  error?: string
  onRetry?: () => void
}) {
  const loading = state === "loading"
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-lg font-semibold">SEO settings</SheetTitle>
        <SheetDescription className="sr-only">
          {loading
            ? "Loading the record's SEO settings."
            : "The record's SEO settings are not available."}
        </SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-6">
        {loading ? (
          <div
            role="status"
            aria-label="Loading SEO settings"
            className="flex flex-col gap-4"
          >
            <Skeleton className="bg-skeleton h-24 rounded-xl" />
            <Skeleton className="bg-skeleton h-48 rounded-xl" />
            <Skeleton className="bg-skeleton h-32 rounded-xl" />
          </div>
        ) : state === "error" ? (
          <EmptyState
            role="alert"
            title="SEO settings didn't load"
            description={error}
            action={
              <Button className={PRIMARY_ACTION} onClick={onRetry}>
                Try again
              </Button>
            }
          />
        ) : (
          <EmptyState
            role="status"
            title="This record isn't in the SEO list"
            description="It may have been deleted. Close this and pick another one."
          />
        )}
      </div>
    </>
  )
}

function SeoSheetBody({
  entry,
  origin,
  defaults,
  onDirtyChange,
  onClose,
}: {
  entry: SeoEntry
  origin: string
  defaults?: SeoOverviewDto["defaults"]
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const save = useSaveSeo(entry.kind, entry.id)
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-lg font-semibold">
          SEO: {entry.name}
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-xs text-muted-foreground">
            {entry.path}
          </code>
          <StatusPill tone={entry.published ? "success" : "neutral"}>
            {entry.published ? "Published" : "Not published"}
          </StatusPill>
        </SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-6">
        <SeoPanel
          kind={entry.kind}
          id={entry.id}
          path={entry.path}
          origin={origin}
          fallback={{
            title: entry.fallback.title,
            // Pages have no description of their own: the site default.
            description:
              entry.kind === "page" ? null : entry.fallback.description,
          }}
          defaultDescription={
            entry.kind === "page" ? entry.fallback.description : undefined
          }
          defaultImageId={defaults?.ogImageId ?? null}
          siteNoindex={defaults?.siteNoindex ?? false}
          value={entry.seo}
          canEdit={canEdit}
          onDirtyChange={onDirtyChange}
          onSave={async (next) => {
            await save(next)
            onClose()
          }}
        />
      </div>
    </>
  )
}
