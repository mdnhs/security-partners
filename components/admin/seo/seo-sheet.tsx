"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { useGuardedClose } from "@/components/admin/editor/discard-changes"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { FORM_ACTION } from "@/components/admin/page-header"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"
import { type Seo, seo as seoSchema } from "@/lib/schemas/common"
import { filled } from "@/lib/seo/effective"

import { SEO_OVERVIEW_KEY } from "./keys"
import { SEO_FIELDS_META } from "./seo-meta"
import { SerpPreview } from "./serp-preview"

/** Same SEO fields? (key order and undefined keys do not count). */
function sameSeo(a: Seo, b: Seo): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every(
    (key) =>
      JSON.stringify(a[key as keyof Seo]) ===
      JSON.stringify(b[key as keyof Seo])
  )
}

/** One record's SEO fields in a right sheet (JW detail pattern); saves are live. */
export function SeoSheet({
  entry,
  origin,
  onClose,
}: {
  entry: SeoEntry
  origin: string
  onClose: () => void
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const queryClient = useQueryClient()
  const [value, setValue] = useState<Seo>(entry.seo)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.seo.entries[":kind"][":id"].$put({
          param: { kind: entry.kind, id: entry.id },
          json: { seo: value },
        })
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData<SeoOverviewDto>(SEO_OVERVIEW_KEY, (old) =>
        old
          ? {
              ...old,
              entries: old.entries.map((e) =>
                e.kind === saved.kind && e.id === saved.id ? saved : e
              ),
            }
          : old
      )
      // The overview and the health (title-unique depends on other records).
      void queryClient.invalidateQueries({ queryKey: ["seo"] })
      toast.success("SEO saved", { description: "The live page uses it now." })
      onClose()
    },
    onError: (error) => {
      setErrors(error instanceof ApiError ? error.fieldErrors : {})
      toast.error("Not saved", { description: errorMessage(error) })
    },
  })
  const dirty = canEdit && !sameSeo(value, entry.seo)
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
        <div className="flex flex-col gap-6 px-4 pb-6">
          <SerpPreview
            title={filled(value.title) ?? entry.fallback.title}
            url={`${origin}${entry.path}`}
            description={
              filled(value.description) ?? entry.fallback.description
            }
          />
          <SchemaForm
            schema={seoSchema}
            meta={SEO_FIELDS_META}
            value={value}
            onChange={(next) => setValue(next as Seo)}
            errors={errors}
            disabled={!canEdit || save.isPending}
            idPrefix={`seo-${entry.kind}-${entry.id}`}
          />
          {canEdit ? (
            <Button
              type="button"
              className={`${FORM_ACTION} self-start`}
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save SEO"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              You can view these settings but not change them.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
