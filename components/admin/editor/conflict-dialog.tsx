"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"

/**
 * Shown when a save gets 409 (spec §8.2): someone else saved first. The
 * user keeps theirs (overwrite), takes theirs (reload) or copies their own
 * text to the clipboard before reloading.
 */
export function ConflictDialog({
  open,
  updatedBy,
  updatedAt,
  onReload,
  onOverwrite,
  onCopyMine,
}: {
  open: boolean
  updatedBy: string | null
  updatedAt: string | null
  onReload: () => void
  onOverwrite: () => void
  onCopyMine: () => void
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Someone else changed this</AlertDialogTitle>
          <AlertDialogDescription>
            {updatedBy ?? "Another editor"} saved a newer version
            {updatedAt ? ` (${formatDateTime(updatedAt)})` : ""} while you were
            editing. Your latest changes are not saved yet.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-wrap">
          <Button type="button" variant="outline" onClick={onCopyMine}>
            Copy mine, then reload
          </Button>
          <Button type="button" variant="outline" onClick={onReload}>
            Reload their version
          </Button>
          <Button type="button" variant="destructive" onClick={onOverwrite}>
            Overwrite with mine
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
