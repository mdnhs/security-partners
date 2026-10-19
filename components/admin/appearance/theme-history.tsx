"use client"

import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { RevisionSummary } from "@/lib/schemas/api/content"

import { THEME_REVISIONS_KEY } from "./use-theme-autosave"

/**
 * Published themes, newest first (MK ThemeHistory). "Load into draft"
 * restores one into the draft; nothing goes live until it is published.
 * Shares its query with the History drawer.
 */
export function ThemeHistory({
  canRestore,
  busy,
  onLoad,
}: {
  canRestore: boolean
  busy: boolean
  onLoad(revision: RevisionSummary): void
}) {
  const revisions = useQuery({
    queryKey: THEME_REVISIONS_KEY,
    queryFn: () =>
      unwrap(
        api.revisions[":entity"][":id"].$get({
          param: { entity: "settings", id: "theme" },
        })
      ),
  })
  const items = revisions.data?.items ?? []
  return (
    <section
      aria-labelledby="theme-history"
      className="flex flex-col gap-3 rounded-xl border bg-card p-5"
    >
      <h2 id="theme-history" className="text-base font-semibold">
        History
      </h2>
      {revisions.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(revisions.error)}
        </p>
      ) : items.length ? (
        <ol aria-label="Published versions" className="flex flex-col divide-y">
          {items.map((revision, index) => (
            <li
              key={revision.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">
                  Version {revision.version}
                  {index === 0 ? " · live" : ""}
                </span>
                <span className="truncate text-muted-foreground">
                  {formatDateTime(revision.createdAt)}
                  {revision.actor ? ` · ${revision.actor.name}` : ""}
                </span>
              </span>
              {canRestore ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="pointer-coarse:h-11"
                  disabled={busy}
                  aria-label={`Load into draft: version ${revision.version}`}
                  onClick={() => onLoad(revision)}
                >
                  Load into draft
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          {revisions.isPending ? "Loading…" : "Nothing published yet."}
        </p>
      )}
    </section>
  )
}
