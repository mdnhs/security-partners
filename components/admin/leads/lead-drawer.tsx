"use client"

import { useCallback, useState } from "react"

import { useConfirmLeave } from "@/components/admin/editor/unsaved-guard"
import { Sheet, SheetContent } from "@/components/ui/sheet"

import { LeadDetailBody } from "./lead-detail"

/**
 * Where focus goes when the drawer closes (D3.2 review M1): the lead's row
 * link or board card, else the list's search box; else Base UI's default
 * (the element that had focus before it opened).
 */
function focusAfterClose(id: string | null): HTMLElement | true {
  if (id) {
    const escaped = CSS.escape(id)
    const target =
      document.querySelector<HTMLElement>(
        `a[href="/admin/leads?lead=${encodeURIComponent(id)}"]`
      ) ?? document.querySelector<HTMLElement>(`[data-lead-card="${escaped}"]`)
    if (target) return target
  }
  return (
    document.querySelector<HTMLElement>('main input[type="search"]') ?? true
  )
}

/**
 * One enquiry in a right-hand drawer over the leads screen (D3.2). `id` is
 * the URL's `?lead=` (already checked to be a UUID); `onClose` clears it.
 * The sheet (Base UI dialog) traps focus, closes on Esc and gives focus
 * back to the lead's row or card. A note typed but not added asks before
 * the drawer closes. The close button stays in reach while the body
 * scrolls, and the content stays during the closing animation.
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
  // The last lead shown, kept through the closing animation (review M2).
  const [lastId, setLastId] = useState<string | null>(shownId)
  if (shownId !== null && shownId !== lastId) setLastId(shownId)
  const bodyId = shownId ?? lastId
  // Each opening gets a fresh body (key), and a close discards a typed note
  // at once (the close was confirmed, or nothing was typed): reopening
  // inside the closing animation never brings back text the guard no
  // longer protects (D3.3 re-review R2). Adjusted during render.
  const [shown, setShown] = useState(shownId !== null)
  const [opens, setOpens] = useState(0)
  const [closes, setCloses] = useState(0)
  if (shown !== (shownId !== null)) {
    setShown(shownId !== null)
    if (shownId !== null) setOpens(opens + 1)
    else setCloses(closes + 1)
  }
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
      onOpenChangeComplete={(open) => {
        if (!open) setLastId(null)
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden bg-card sm:max-w-xl"
        finalFocus={() => focusAfterClose(bodyId)}
      >
        {/* The body scrolls; the close button (absolute) stays put (M3). */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {bodyId ? (
            <LeadDetailBody
              key={`${bodyId}:${opens}`}
              id={bodyId}
              discardNote={closes}
              onMissing={onMissing}
              onDeleted={() => {
                if (id !== null) onClose()
              }}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
