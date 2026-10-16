"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { RevisionEntity, RevisionSummary } from "@/lib/schemas/api/content"

/** Published versions of a record, newest first, each restorable into the draft. */
export function RevisionDrawer({
  open,
  onOpenChange,
  entity,
  entityId,
  canRestore,
  onRestore,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: RevisionEntity
  entityId: string
  canRestore: boolean
  onRestore: (revision: RevisionSummary) => Promise<void>
}) {
  const [confirm, setConfirm] = useState<RevisionSummary | null>(null)
  const [pending, setPending] = useState(false)
  const revisions = useQuery({
    queryKey: ["revisions", entity, entityId],
    queryFn: () =>
      unwrap(
        api.revisions[":entity"][":id"].$get({
          param: { entity, id: entityId },
        })
      ),
    enabled: open,
  })
  const items = revisions.data?.items ?? []
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>History</SheetTitle>
            <SheetDescription>
              Every publish is kept. Restoring loads that version into the
              draft; publish it to make it live.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {revisions.isPending ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : revisions.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(revisions.error)}
              </p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <History aria-hidden className="size-6" />
                Nothing published from the admin yet.
              </div>
            ) : (
              <ol
                aria-label="Published versions"
                className="flex flex-col gap-2"
              >
                {items.map((revision, index) => (
                  <li
                    key={revision.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        Version {revision.version}
                        {index === 0 ? " · live" : ""}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatDateTime(revision.createdAt)}
                        {revision.actor ? ` · ${revision.actor.name}` : ""}
                      </span>
                    </div>
                    {canRestore ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Restore version ${revision.version}`}
                        onClick={() => setConfirm(revision)}
                      >
                        Restore
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore version {confirm?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The draft is replaced with this version. The site does not change
              until you publish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (!confirm) return
                setPending(true)
                try {
                  await onRestore(confirm)
                  setConfirm(null)
                  onOpenChange(false)
                } catch {
                  // onRestore reports the failure; keep the dialog open to retry.
                } finally {
                  setPending(false)
                }
              }}
            >
              Restore into draft
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
