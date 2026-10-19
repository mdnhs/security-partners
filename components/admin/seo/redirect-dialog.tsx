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
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { RedirectDto } from "@/lib/schemas/api/redirects"

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

const REDIRECT_CODES = [
  { value: "301", label: "Permanent (301) — the page moved for good" },
  { value: "302", label: "Temporary (302) — it will come back" },
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
  const [code, setCode] = useState<301 | 302>(redirect?.code ?? 301)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef = useRef<HTMLInputElement>(null)
  const title = redirect ? "Edit redirect" : "Add redirect"
  const save = useMutation({
    mutationFn: () =>
      redirect
        ? unwrap(
            api.redirects[":id"].$patch({
              param: { id: redirect.id },
              json: { fromPath, toPath, code },
            })
          )
        : unwrap(api.redirects.$post({ json: { fromPath, toPath, code } })),
    onSuccess: () => {
      toast.success(redirect ? "Redirect saved" : "Redirect added")
      onSaved()
      onClose()
    },
    onError: (error) => {
      const fieldErrors = error instanceof ApiError ? error.fieldErrors : {}
      setErrors(fieldErrors)
      // Errors on other keys (code, a root refine) have no inline place.
      if (!fieldErrors.fromPath?.length && !fieldErrors.toPath?.length) {
        toast.error("Not saved", { description: errorMessage(error) })
        return
      }
      // Focus the first invalid field so screen readers announce its error.
      const first = fieldErrors.fromPath?.length ? fromRef : toRef
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
  const dirty =
    !save.isSuccess &&
    (fromPath !== (redirect?.fromPath ?? "") ||
      toPath !== (redirect?.toPath ?? "") ||
      code !== (redirect?.code ?? 301))
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="redirect-code">Type</Label>
            <OptionSelect
              id="redirect-code"
              value={String(code)}
              onChange={(value) => setCode(Number(value) === 302 ? 302 : 301)}
              options={REDIRECT_CODES}
              className="rounded-xl bg-card shadow-none data-[size=default]:h-11"
            />
          </div>
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
