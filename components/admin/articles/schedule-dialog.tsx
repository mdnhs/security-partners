"use client"

import { useState } from "react"

import { ADMIN_CONTROL } from "@/components/admin/form/form-ui"
import { FORM_ACTION } from "@/components/admin/page-header"
import {
  describedBy,
  FieldShell,
} from "@/components/admin/schema-form/widgets/field-shell"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { formatDateTime, fromDublinInput, toDublinInput } from "@/lib/format"

const HOUR = 60 * 60_000
const FIELD = "schedule-at"

/** Pick when an article goes live, in Irish time (Europe/Dublin). */
export function ScheduleDialog({
  open,
  onOpenChange,
  initial,
  pending,
  serverError = null,
  onEdit,
  onConfirm,
  now = () => new Date(),
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The current schedule (ISO), if any. */
  initial: string | null
  pending: boolean
  /** The API's message about the time (422 fieldErrors.scheduledAt). */
  serverError?: string | null
  /** The time was edited (clears serverError). */
  onEdit?: () => void
  onConfirm: (scheduledAt: string) => void
  /** Clock (tests). */
  now?: () => Date
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <ScheduleForm
            initial={initial}
            pending={pending}
            serverError={serverError}
            onEdit={onEdit}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
            now={now}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Mounted per opening, so it starts from the current schedule. */
function ScheduleForm({
  initial,
  pending,
  serverError,
  onEdit,
  onConfirm,
  onCancel,
  now,
}: {
  initial: string | null
  pending: boolean
  serverError: string | null
  onEdit?: () => void
  onConfirm: (scheduledAt: string) => void
  onCancel: () => void
  now: () => Date
}) {
  const [value, setValue] = useState(() =>
    toDublinInput(
      initial ? new Date(initial) : new Date(now().getTime() + HOUR)
    )
  )
  const [localError, setError] = useState<string | null>(null)
  const error = localError ?? serverError
  const at = fromDublinInput(value)
  // How the picked time reads, in words (the input's own display follows
  // the browser's locale).
  const help = at
    ? `Goes live ${formatDateTime(at)} (Irish time).`
    : "Irish time (Europe/Dublin)."
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!at) {
          setError("Enter a date and a time.")
          return
        }
        if (at.getTime() <= now().getTime()) {
          setError("Choose a time in the future.")
          return
        }
        onConfirm(at.toISOString())
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          Schedule publishing
        </DialogTitle>
        <DialogDescription>
          The article goes live on its own within a minute of this time.
        </DialogDescription>
      </DialogHeader>
      <FieldShell
        id={FIELD}
        label="Publish on"
        help={help}
        error={error ?? undefined}
      >
        <Input
          id={FIELD}
          type="datetime-local"
          step={60}
          min={toDublinInput(now())}
          value={value}
          className={ADMIN_CONTROL}
          aria-required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(FIELD, {
            help,
            error: error ?? undefined,
          })}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
            onEdit?.()
          }}
        />
      </FieldShell>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className={FORM_ACTION}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" className={FORM_ACTION} disabled={pending}>
          {pending ? <Spinner /> : null}
          Schedule
        </Button>
      </DialogFooter>
    </form>
  )
}
