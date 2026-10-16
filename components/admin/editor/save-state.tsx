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

/**
 * Live save status in the editor header (announced politely): a pill on
 * the bar's white card with a coloured dot, JW style. The label stays
 * exactly "Saved" (the e2e page-editor spec asserts it).
 */
export function SaveStateIndicator({
  state,
  onRetry,
}: {
  state: SaveState
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <p
        role="status"
        aria-live="polite"
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
