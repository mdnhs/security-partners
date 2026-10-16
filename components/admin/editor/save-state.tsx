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

/** Text and icon colour per state (soft pill in the editor header). */
const TONE: Record<SaveState, string> = {
  saved: "bg-muted text-muted-foreground [&_svg]:text-success",
  saving: "bg-muted text-muted-foreground [&_svg]:text-primary",
  unsaved: "bg-warning-soft text-warning",
  invalid: "bg-danger-soft text-danger",
  conflict: "bg-danger-soft text-danger",
  error: "bg-danger-soft text-danger",
}

/** Live save status in the editor header (announced politely). */
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
          "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap",
          TONE[state]
        )}
      >
        <Icon
          aria-hidden
          className={cn("size-4", state === "saving" && "animate-spin")}
        />
        {LABELS[state]}
      </p>
      {state === "error" && onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl px-4 font-semibold pointer-coarse:h-11"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  )
}
