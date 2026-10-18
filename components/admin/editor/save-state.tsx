"use client"

import { Button } from "@/components/ui/button"
import type { SaveState } from "@/hooks/use-autosave"
import { cn } from "@/lib/utils"

import { EDITOR_ACTION } from "./editor-layout"

const LABELS: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  invalid: "Fix errors to save",
  conflict: "Conflict",
  error: "Not saved",
}

/** The dot's colour per state (JW save indicator). */
const DOT: Record<SaveState, string> = {
  saved: "bg-success",
  saving: "bg-primary motion-safe:animate-pulse",
  unsaved: "bg-warning",
  invalid: "bg-danger",
  conflict: "bg-danger",
  error: "bg-danger",
}

/** Text colour: muted unless something needs doing (not colour alone: the text says so). */
const TEXT: Record<SaveState, string> = {
  saved: "text-muted-foreground",
  saving: "text-muted-foreground",
  unsaved: "text-warning",
  invalid: "text-danger",
  conflict: "text-danger",
  error: "text-danger",
}

/** States a screen reader hears about: something needs doing. */
const ANNOUNCED: ReadonlySet<SaveState> = new Set([
  "invalid",
  "conflict",
  "error",
])

/**
 * Save status in the editor header: a pill on the bar's white card with a
 * coloured dot, JW style. The label stays exactly "Saved" (the e2e
 * page-editor spec asserts it). The pill itself is not a live region
 * (final review M4: "Unsaved changes → Saving… → Saved" on every autosave
 * cycle was read out each time); a separate polite region announces only
 * failures and conflicts, and "Saved" after an explicit save (⌘S).
 */
export function SaveStateIndicator({
  state,
  onRetry,
  savedOnRequest = false,
}: {
  state: SaveState
  onRetry?: () => void
  /** The person asked to save (⌘S): announce "Saved" when it lands. */
  savedOnRequest?: boolean
}) {
  const announcement = ANNOUNCED.has(state)
    ? LABELS[state]
    : state === "saved" && savedOnRequest
      ? LABELS.saved
      : ""
  return (
    <div className="flex items-center gap-2">
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <p
        role="status"
        aria-live="off"
        aria-label={`Save status: ${LABELS[state]}`}
        data-save-state={state}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full bg-muted px-3.5 text-[13px] font-semibold whitespace-nowrap",
          TEXT[state]
        )}
      >
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", DOT[state])}
        />
        {LABELS[state]}
      </p>
      {state === "error" && onRetry ? (
        <Button
          type="button"
          variant="outline"
          className={EDITOR_ACTION}
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  )
}
