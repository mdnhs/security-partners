"use client"

import { useState } from "react"

import { useGuardedClose } from "@/components/admin/editor/discard-changes"
import { StatusPill } from "@/components/admin/kit/status-pill"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { usePermission } from "@/hooks/use-permission"
import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"

import { SeoPanel } from "./seo-panel"
import { useSaveSeo } from "./use-save-seo"

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
