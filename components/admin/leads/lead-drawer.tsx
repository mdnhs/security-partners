"use client"

import { useCallback, useState } from "react"

import { useConfirmLeave } from "@/components/admin/editor/unsaved-guard"
import { Sheet, SheetContent } from "@/components/ui/sheet"

import { LeadDetailBody } from "./lead-detail"

/**
 * One enquiry in a right-hand drawer over the leads screen (D3.2). `id` is
 * the URL's `?lead=` (already checked to be a UUID); `onClose` clears it.
 * The sheet (Base UI dialog) traps focus, closes on Esc and gives focus
 * back to the row or card that opened it. A note typed but not added asks
 * before the drawer closes.
 *
 * A lead that does not exist (deleted meanwhile) shows "This enquiry no
 * longer exists" and clears `?lead=` at once; the message stays until it is
 * closed.
 */
export function LeadDrawer({
  id,
  onClose,
}: {
  id: string | null
  onClose(): void
}) {
  const [missingId, setMissingId] = useState<string | null>(null)
  // Another lead was opened: the old message is gone (adjusted in render).
  if (id !== null && missingId !== null && missingId !== id) setMissingId(null)
  const shownId = id ?? missingId
  const confirmLeave = useConfirmLeave()

  const close = () => {
    void confirmLeave().then((leave) => {
      if (!leave) return
      setMissingId(null)
      if (id !== null) onClose()
    })
  }
  const onMissing = useCallback(() => {
    if (id === null) return
    setMissingId(id)
    onClose()
  }, [id, onClose])

  return (
    <Sheet
      open={shownId !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto bg-card sm:max-w-xl"
      >
        {shownId ? (
          <LeadDetailBody
            key={shownId}
            id={shownId}
            onMissing={onMissing}
            onDeleted={() => {
              if (id !== null) onClose()
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
