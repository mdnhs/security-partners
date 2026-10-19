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

/**
 * The SEO sheet before its record is ready (?edit= set): loading, failed
 * (with Try again) or not found. Never an empty sheet or no sheet at all.
 */
export function SeoSheetPlaceholder({
  state,
  error,
  onRetry,
  onClose,
}: {
  state: "loading" | "error" | "missing"
  error?: string
  onRetry: () => void
  onClose: () => void
}) {
  const loading = state === "loading"
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        aria-busy={loading || undefined}
        className="w-full overflow-y-auto bg-card sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">
            SEO settings
          </SheetTitle>
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
      </SheetContent>
    </Sheet>
  )
}

/** One record's SEO fields in a right sheet (JW detail pattern); saves are live. */
export function SeoSheet({
  entry,
  origin,
  defaults,
  onClose,
}: {
  entry: SeoEntry
  origin: string
  /** SeoOverviewDto.defaults (the site share image). */
  defaults?: SeoOverviewDto["defaults"]
  onClose: () => void
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const save = useSaveSeo(entry.kind, entry.id)
  const [dirty, setDirty] = useState(false)
  const close = useGuardedClose({
    dirty,
    onClose,
    title: "Discard your SEO changes?",
    description: `The changes to ${entry.name} are not saved. The live page keeps its current settings.`,
  })
  return (
    // Esc, the close button or a click outside: never drop edits silently.
    <Sheet open onOpenChange={close.onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-xl">
        {/* Inside the sheet's popup: a nested dialog (Esc closes it only). */}
        {close.guard}
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
            value={entry.seo}
            canEdit={canEdit}
            onDirtyChange={setDirty}
            onSave={async (next) => {
              await save(next)
              onClose()
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
