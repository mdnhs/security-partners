"use client"

import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { SeoKind } from "@/lib/schemas/api/seo"
import { filled } from "@/lib/seo/effective"

import { SEO_OVERVIEW_KEY } from "./keys"
import { SeoPanel } from "./seo-panel"
import { useSaveSeo } from "./use-save-seo"

/** The record's name and summary in its live content and in the editor's draft. */
export type DraftNames = {
  live: string | null
  draft: string | null
  /** Service intro / article excerpt in the draft; undefined for pages. */
  description?: string | null
}

/** A string at `path` in JSON-like content (a draft), else null. */
export function textAt(value: unknown, ...path: string[]): string | null {
  let at: unknown = value
  for (const key of path) {
    if (!at || typeof at !== "object") return null
    at = (at as Record<string, unknown>)[key]
  }
  return typeof at === "string" ? at : null
}

/**
 * The draft's title fallback: the live one (site title pattern applied by
 * the server) with the live name swapped for the draft's, so the previews
 * follow an unsaved rename.
 */
export function draftFallbackTitle(
  liveFallback: string,
  names: DraftNames
): string {
  const live = filled(names.live)
  const draft = filled(names.draft)
  if (!live || !draft || live === draft || !liveFallback.includes(live))
    return liveFallback
  return liveFallback.replace(live, draft)
}

/**
 * An editor's SEO tab (MK D1.4): the record's SEO entry (GET /seo/overview)
 * in a SeoPanel whose fallbacks come from the unsaved draft. Saves are live
 * (PUT /seo/entries/:kind/:id) and never touch the content draft.
 */
export function EditorSeoTab({
  kind,
  id,
  origin,
  names,
}: {
  kind: SeoKind
  id: string
  origin?: string
  names: DraftNames
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const query = useQuery({
    queryKey: SEO_OVERVIEW_KEY,
    queryFn: () => unwrap(api.seo.overview.$get()),
  })
  const save = useSaveSeo(kind, id)
  if (query.isPending)
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="sr-only">Loading SEO…</span>
        <Skeleton className="bg-skeleton rounded-card h-64" />
      </div>
    )
  const entry = query.data?.entries?.find((e) => e.kind === kind && e.id === id)
  if (query.isError || !entry)
    return (
      <div
        role="alert"
        className="rounded-card flex flex-col items-start gap-3 border bg-card p-6"
      >
        <p className="font-medium">The SEO settings could not be loaded.</p>
        {query.isError ? (
          <p className="text-sm text-muted-foreground">
            {errorMessage(query.error)}
          </p>
        ) : null}
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )
  const description =
    names.description === undefined ? null : (filled(names.description) ?? null)
  return (
    <div className="rounded-card border bg-card p-4 sm:p-6">
      <SeoPanel
        kind={kind}
        id={id}
        path={entry.path}
        origin={origin}
        fallback={{
          title: draftFallbackTitle(entry.fallback.title, names),
          description,
        }}
        value={entry.seo}
        canEdit={canEdit}
        onSave={async (next) => {
          await save(next)
        }}
      />
    </div>
  )
}
