"use client"

import { useMutation } from "@tanstack/react-query"
import { type ChangeEvent, useRef, useState } from "react"
import { toast } from "sonner"

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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { RedirectCode } from "@/lib/schemas/api/redirects"
import { cn } from "@/lib/utils"

/** server/modules/redirects/service.ts ImportRow (type-only mirror). */
type ImportRow = {
  line: number
  from: string
  to: string
  code: RedirectCode
  note: string
  status: "create" | "update" | "unchanged" | "error"
  message?: string
}
type Preview = {
  rows: ImportRow[]
  created: number
  updated: number
  unchanged?: number
}

/** The admin API body limit (1 MB); bigger files are refused before upload. */
const MAX_FILE_BYTES = 1024 * 1024

/**
 * The request body is JSON: quotes and line breaks in the file grow when
 * escaped, so a file under 1 MB can still be over the limit once sent.
 */
const bodyBytes = (csv: string) =>
  new TextEncoder().encode(JSON.stringify({ csv, mode: "preview" })).length

const SOFT_DISABLED =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:translate-y-0"

const STATUS_LABEL: Record<ImportRow["status"], string> = {
  create: "New",
  update: "Updates the existing redirect",
  unchanged: "No change",
  error: "Fix",
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function Summary({ preview }: { preview: Preview }) {
  const errors = preview.rows.filter((r) => r.status === "error").length
  const unchanged = preview.unchanged ? ` · ${preview.unchanged} unchanged` : ""
  return (
    <p className="text-sm font-medium">
      {`${preview.created} new · ${preview.updated} updated${unchanged} · ${errors} to fix`}
      {errors > 0 ? (
        <span className="block font-normal text-muted-foreground">
          Fix the rows marked Fix in the file and choose it again. Nothing is
          imported while any row needs fixing.
        </span>
      ) : null}
    </p>
  )
}

function RowsTable({ rows }: { rows: ImportRow[] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border">
      <Table>
        <TableCaption className="sr-only">Rows in the file</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Line</TableHead>
            <TableHead scope="col">From</TableHead>
            <TableHead scope="col">To</TableHead>
            <TableHead scope="col">Type</TableHead>
            <TableHead scope="col">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.line}>
              <TableCell className="tabular-nums">{row.line}</TableCell>
              <TableCell className="font-mono text-xs break-all whitespace-normal">
                {row.from}
              </TableCell>
              <TableCell className="font-mono text-xs break-all whitespace-normal">
                {row.to}
              </TableCell>
              <TableCell className="tabular-nums">{row.code}</TableCell>
              <TableCell className="whitespace-normal">
                <span
                  className={cn(
                    "font-medium",
                    row.status === "error" && "text-destructive"
                  )}
                >
                  {STATUS_LABEL[row.status]}
                </span>
                {row.message ? (
                  <span className="block text-sm text-destructive">
                    {row.message}
                  </span>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * SEO › Redirects › Import CSV (D1.8): choose a file, see every row checked
 * by the server (preview writes nothing), then import all of it or nothing.
 */
export function RedirectImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => void
}) {
  const [csv, setCsv] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // The file chosen last: a slower check of an earlier file is ignored.
  const latest = useRef<string | null>(null)

  const check = useMutation({
    mutationFn: (text: string) =>
      unwrap(
        api.redirects.import.$post({ json: { csv: text, mode: "preview" } })
      ),
    onSuccess: (result, text) => {
      if (text === latest.current) setPreview(result as Preview)
    },
    onError: (error, text) => {
      if (text !== latest.current) return
      setFileError(errorMessage(error))
      fileRef.current?.focus()
    },
  })
  const commit = useMutation({
    mutationFn: (text: string) =>
      unwrap(
        api.redirects.import.$post({ json: { csv: text, mode: "commit" } })
      ),
    onSuccess: (result) => {
      toast.success(
        `Imported: ${plural(result.created, "new redirect")}, ${result.updated} updated`
      )
      onImported()
      onClose()
    },
    onError: (error) => {
      const rows =
        error instanceof ApiError
          ? (error.current as { rows?: ImportRow[] } | undefined)?.rows
          : undefined
      if (rows)
        setPreview({
          rows,
          created: rows.filter((r) => r.status === "create").length,
          updated: rows.filter((r) => r.status === "update").length,
          unchanged: rows.filter((r) => r.status === "unchanged").length,
        })
      toast.error("Nothing was imported", { description: errorMessage(error) })
    },
  })

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    latest.current = null
    setPreview(null)
    setFileError(null)
    setCsv(null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setFileError("Choose a file under 1 MB, or split it into parts.")
      return
    }
    const text = await file.text()
    // A newer choice while this file was read: it wins.
    if (event.target.files?.[0] !== file) return
    if (bodyBytes(text) > MAX_FILE_BYTES) {
      setFileError(
        "This file is over 1 MB once sent (quotes and line breaks count extra). Split it into parts."
      )
      return
    }
    latest.current = text
    setCsv(text)
    check.mutate(text)
  }

  const errors = preview?.rows.filter((r) => r.status === "error").length ?? 0
  const total = preview ? preview.created + preview.updated : 0
  const ready = csv !== null && preview !== null && errors === 0 && total > 0
  const busy = check.isPending || commit.isPending

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !commit.isPending) onClose()
      }}
    >
      <DialogContent className="bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import redirects</DialogTitle>
          <DialogDescription>
            A CSV file with the columns from and to; code (301, 302, 307 or 308,
            default 301), active (yes or no) and note are optional. An address
            that already has a redirect is updated; an empty active keeps it on
            or off. Nothing is saved until you import.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="redirect-import-file">CSV file</Label>
            <Input
              id="redirect-import-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={choose}
              aria-invalid={fileError ? true : undefined}
              aria-describedby={
                fileError
                  ? "redirect-import-hint redirect-import-error"
                  : "redirect-import-hint"
              }
              className="h-11 rounded-xl"
            />
            <p
              id="redirect-import-hint"
              className="text-sm text-muted-foreground"
            >
              Up to 1,000 redirects and 1 MB. Export CSV gives a file in this
              format.
            </p>
            {fileError ? (
              <p
                id="redirect-import-error"
                className="text-sm font-medium text-destructive"
              >
                {fileError}
              </p>
            ) : null}
          </div>
          <div aria-live="polite" className="flex flex-col gap-3">
            {check.isPending ? (
              <p className="text-sm text-muted-foreground">
                Checking the file…
              </p>
            ) : null}
            {preview ? <Summary preview={preview} /> : null}
          </div>
          {preview ? <RowsTable rows={preview.rows} /> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={FORM_ACTION}
            onClick={onClose}
            disabled={commit.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            // aria-disabled, not disabled: a refused import keeps focus here
            // (WCAG 2.4.3); the handler checks the same condition.
            className={cn(FORM_ACTION, SOFT_DISABLED)}
            aria-disabled={!ready || busy || undefined}
            onClick={() => {
              if (ready && !busy && csv !== null) commit.mutate(csv)
            }}
          >
            {commit.isPending
              ? "Importing…"
              : ready
                ? `Import ${plural(total, "redirect")}`
                : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
