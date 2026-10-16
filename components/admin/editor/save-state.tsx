"use client"

import {
  AlertTriangle,
  Check,
  CircleDashed,
  CloudOff,
  GitMerge,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SaveState } from "@/hooks/use-autosave"
import { cn } from "@/lib/utils"

const LABELS: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  invalid: "Fix errors to save",
  conflict: "Conflict",
  error: "Not saved",
}

const ICONS = {
  saved: Check,
  saving: Loader2,
  unsaved: CircleDashed,
  invalid: AlertTriangle,
  conflict: GitMerge,
  error: CloudOff,
} satisfies Record<SaveState, unknown>

/** Live save status next to the editor title (announced politely). */
export function SaveStateIndicator({
  state,
  onRetry,
}: {
  state: SaveState
  onRetry?: () => void
}) {
  const Icon = ICONS[state]
  return (
    <div className="flex items-center gap-2">
      <p
        role="status"
        aria-live="polite"
        aria-label={`Save status: ${LABELS[state]}`}
        data-save-state={state}
        className={cn(
          "flex items-center gap-1.5 text-sm",
          state === "saved" && "text-muted-foreground",
          (state === "invalid" || state === "conflict" || state === "error") &&
            "font-medium text-destructive"
        )}
      >
        <Icon
          aria-hidden
          className={cn("size-4", state === "saving" && "animate-spin")}
        />
        {LABELS[state]}
      </p>
      {state === "error" && onRetry ? (
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}
