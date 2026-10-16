"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { issuesToFieldErrors } from "@/components/admin/editor/versioned-editor"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ApiError, errorMessage } from "@/lib/api-client"

/**
 * Create/edit one small-collection record in a side sheet. Saving publishes
 * immediately (spec §5.3); the same Zod schema validates here and on the API.
 */
export function RecordSheet({
  open,
  onOpenChange,
  title,
  description,
  schema,
  meta,
  initial,
  onSave,
  onDelete,
  deleteLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  schema: z.ZodObject
  meta: EditorMeta
  initial: unknown
  onSave: (value: unknown) => Promise<unknown>
  /** Omitted for new records or without delete permission. */
  onDelete?: () => Promise<unknown>
  deleteLabel?: string
}) {
  const [value, setValue] = useState<unknown>(initial)
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useMutation({
    mutationFn: () => {
      const parsed = schema.safeParse(value)
      if (!parsed.success) {
        setErrors(issuesToFieldErrors(parsed.error))
        throw new Error("Some fields need attention")
      }
      return onSave(parsed.data)
    },
    onSuccess: () => {
      toast.success(`${title} saved`, {
        description: "The site shows the change now.",
      })
      onOpenChange(false)
    },
    onError: (error) => {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length)
        setErrors(error.fieldErrors)
      toast.error("Not saved", {
        description:
          error instanceof ApiError || !(error instanceof Error)
            ? errorMessage(error)
            : error.message,
      })
    },
  })
  const remove = useMutation({
    mutationFn: () => onDelete!(),
    onSuccess: () => {
      toast.success(`${title} deleted`)
      setConfirmDelete(false)
      onOpenChange(false)
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error("Not deleted", { description: errorMessage(error) })
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 bg-card sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <SchemaForm
            schema={schema}
            meta={meta}
            value={value as never}
            onChange={setValue}
            errors={errors}
            idPrefix="record"
          />
        </div>
        <SheetFooter className="flex-row justify-between border-t">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              {deleteLabel ?? "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={FORM_ACTION}
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {title.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the site straight away. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
