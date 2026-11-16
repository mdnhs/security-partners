"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Download, ShieldCheck, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { downloadCsv } from "@/components/admin/leads/csv-download-button"
import { SECONDARY_ACTION } from "@/components/admin/page-header"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { EmailInput } from "@/lib/schemas/api/chat"

import { chatKeys } from "./queries"

/** The export's URL: a JSON download named by the server. */
const exportHref = (email: string) =>
  `/api/v1/admin/chat/export?email=${encodeURIComponent(email)}`

/**
 * A person's request about their chats (live chat C4): download every chat
 * held for an email address, or erase them all after a confirm. Shown to
 * chat:manage only; the API checks it again.
 */
export function PrivacyRequestDialog() {
  const client = useQueryClient()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"download" | "erase" | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  /** The typed address, checked and normalised; null shows the error. */
  const checked = (): string | null => {
    const parsed = EmailInput.safeParse({ email })
    if (parsed.success) {
      setError(null)
      return parsed.data.email
    }
    setError("Enter a valid email address.")
    return null
  }

  const download = async () => {
    const address = checked()
    if (!address || busy) return
    setBusy("download")
    try {
      await downloadCsv(exportHref(address))
    } catch (failure) {
      toast.error("Download failed", { description: errorMessage(failure) })
    } finally {
      setBusy(null)
    }
  }

  const erase = async (address: string) => {
    if (busy) return
    setBusy("erase")
    try {
      const { erased } = await unwrap(
        api.chat.erase.$post({ json: { email: address } })
      )
      toast.success(erased === 1 ? "1 chat erased" : `${erased} chats erased`)
      setConfirm(null)
      setOpen(false)
      setEmail("")
      await client.invalidateQueries({ queryKey: chatKeys.all })
    } catch (failure) {
      toast.error("Erase failed", { description: errorMessage(failure) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={SECONDARY_ACTION}
        onClick={() => setOpen(true)}
      >
        <ShieldCheck aria-hidden />
        Privacy request
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setError(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Privacy request</DialogTitle>
            <DialogDescription>
              Download or erase every chat held for one email address.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void download()
            }}
          >
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
              <Input
                id={`${id}-email`}
                type="email"
                autoComplete="off"
                value={email}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
              {error ? (
                <FieldError id={`${id}-error`}>{error}</FieldError>
              ) : null}
            </Field>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              aria-busy={busy === "download" || undefined}
              onClick={() => void download()}
            >
              <Download aria-hidden />
              Download chats
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const address = checked()
                if (address) setConfirm(address)
              }}
            >
              <Trash2 aria-hidden />
              Erase chats
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(next) => {
          if (!next) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Erase every chat for {confirm}? This can&apos;t be undone.
            </AlertDialogTitle>
            <AlertDialogDescription>
              The chats and all their messages are removed for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={busy === "erase"}
              onClick={() => {
                if (confirm) void erase(confirm)
              }}
            >
              Erase chats
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
