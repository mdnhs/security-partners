"use client"

import { type ReactNode, useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { UnsavedGuard } from "./unsaved-guard"

/**
 * Close guard for an edit sheet or dialog (final review I2): Esc, a click
 * outside, ✕ and Cancel all go through `requestClose`, which asks "Discard
 * changes?" while `dirty` instead of dropping the edits. `guard` holds the
 * confirm (render it INSIDE the sheet/dialog popup, so Esc closes only the
 * confirm) plus an `<UnsavedGuard>` for links, ⌘K, Back and reloads.
 */
export function useGuardedClose({
  dirty,
  onClose,
  title = "Discard changes?",
  description = "Your changes here are not saved yet. If you close now, they are lost.",
}: {
  dirty: boolean
  onClose: () => void
  title?: string
  description?: ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const requestClose = () => {
    if (dirty) setConfirming(true)
    else onClose()
  }
  const guard = (
    <>
      <UnsavedGuard when={dirty} />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirming(false)
                onClose()
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
  return {
    requestClose,
    /** For a Sheet/Dialog `onOpenChange`: closing goes through the guard. */
    onOpenChange: (open: boolean) => {
      if (!open) requestClose()
    },
    guard,
  }
}
