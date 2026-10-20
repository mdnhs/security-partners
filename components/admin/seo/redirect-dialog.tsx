"use client"

import { useMutation } from "@tanstack/react-query"
import { type FormEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { useGuardedClose } from "@/components/admin/editor/discard-changes"
import { OptionSelect } from "@/components/admin/option-select"
import { FORM_ACTION } from "@/components/admin/page-header"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import {
  REDIRECT_NOTE_MAX,
  type RedirectCode,
  redirectCode,
  type RedirectDto,
} from "@/lib/schemas/api/redirects"

function FieldRow({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint: string
  error: string | undefined
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const CODE_OPTIONS: { value: `${RedirectCode}`; label: string }[] = [
  { value: "301", label: "Permanent (301) — the page moved for good" },
  { value: "302", label: "Temporary (302) — it will come back" },
  {
    value: "307",
    label: "Temporary, keep method (307) — for forms and APIs",
  },
  {
    value: "308",
    label: "Permanent, keep method (308) — for forms and APIs",
  },
]

const describedBy = (id: string, error: string | undefined) =>
  error ? `${id}-hint ${id}-error` : `${id}-hint`

/** Add or edit one redirect; API field errors (loops, live pages) show inline. */
export function RedirectDialog({
  redirect,
  onClose,
  onSaved,
}: {
  redirect: RedirectDto | null
  onClose: () => void
  onSaved: () => void
}) {
  const [fromPath, setFromPath] = useState(redirect?.fromPath ?? "")
  const [toPath, setToPath] = useState(redirect?.toPath ?? "")
  const [code, setCode] = useState<RedirectCode>(redirect?.code ?? 301)
  const [note, setNote] = useState(redirect?.note ?? "")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const title = redirect ? "Edit redirect" : "Add redirect"
  const save = useMutation({
    mutationFn: () => {
      const json = { fromPath, toPath, code, note: note.trim() }
      return redirect
        ? unwrap(
            api.redirects[":id"].$patch({ param: { id: redirect.id }, json })
          )
        : unwrap(api.redirects.$post({ json }))
    },
    onSuccess: () => {
      toast.success(redirect ? "Redirect saved" : "Redirect added")
      onSaved()
      onClose()
    },
    onError: (error) => {
      const fieldErrors = error instanceof ApiError ? error.fieldErrors : {}
      setErrors(fieldErrors)
      // Errors on other keys (code, a root refine) have no inline place.
      const first = fieldErrors.fromPath?.length
        ? fromRef
        : fieldErrors.toPath?.length
          ? toRef
          : fieldErrors.note?.length
            ? noteRef
            : null
      if (!first) {
        toast.error("Not saved", { description: errorMessage(error) })
        return
      }
      // Focus the first invalid field so screen readers announce its error.
      first.current?.focus()
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    save.mutate()
  }
  const fromError = errors.fromPath?.[0]
  const toError = errors.toPath?.[0]
  const noteError = errors.note?.[0]
  const dirty =
    !save.isSuccess &&
    (fromPath !== (redirect?.fromPath ?? "") ||
      toPath !== (redirect?.toPath ?? "") ||
      code !== (redirect?.code ?? 301) ||
      note !== (redirect?.note ?? ""))
  const close = useGuardedClose({
    dirty,
    onClose,
    title: "Discard this redirect?",
    description: "The addresses you entered are not saved yet.",
  })
  return (
    <Dialog open onOpenChange={close.onOpenChange}>
      <DialogContent className="bg-card sm:max-w-lg">
        {/* Inside the popup: Esc closes only the confirm. */}
        {close.guard}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Visitors and search engines asking for the old address are sent to
            the new one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FieldRow
            id="redirect-from"
            label="Old address"
            hint="A path on this site, e.g. /old-page"
            error={fromError}
          >
            <Input
              id="redirect-from"
              ref={fromRef}
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              required
              autoComplete="off"
              aria-invalid={fromError ? true : undefined}
              aria-describedby={describedBy("redirect-from", fromError)}
              className="h-11 rounded-xl font-mono"
            />
          </FieldRow>
          <FieldRow
            id="redirect-to"
            label="New address"
            hint="A site path like /services, or a full https:// link"
            error={toError}
          >
            <Input
              id="redirect-to"
              ref={toRef}
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              required
              autoComplete="off"
              aria-invalid={toError ? true : undefined}
              aria-describedby={describedBy("redirect-to", toError)}
              className="h-11 rounded-xl font-mono"
            />
          </FieldRow>
          <FieldRow
            id="redirect-code"
            label="Type"
            hint="Use 301 unless the move is temporary. 307 and 308 keep a submitted form as it was sent; search engines treat 308 like 301 and 307 like 302."
            error={undefined}
          >
            <OptionSelect
              id="redirect-code"
              value={String(code)}
              onChange={(value) => setCode(redirectCode(Number(value)))}
              options={CODE_OPTIONS}
              aria-describedby="redirect-code-hint"
              className="rounded-xl bg-card shadow-none data-[size=default]:h-11"
            />
          </FieldRow>
          <FieldRow
            id="redirect-note"
            label="Note"
            hint={`Optional, for your team only: why this redirect exists. Up to ${REDIRECT_NOTE_MAX} characters.`}
            error={noteError}
          >
            <Textarea
              id="redirect-note"
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={REDIRECT_NOTE_MAX}
              rows={2}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={describedBy("redirect-note", noteError)}
              className="rounded-xl"
            />
          </FieldRow>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              onClick={close.requestClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={FORM_ACTION}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : redirect ? "Save" : "Add redirect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
