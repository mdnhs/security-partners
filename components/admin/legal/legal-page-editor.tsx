"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { EDITOR_ACTION } from "@/components/admin/editor/editor-layout"
import {
  type EditorActionContext,
  VersionedEditor,
} from "@/components/admin/editor/versioned-editor"
import { ADMIN_CONTROL, FormCard } from "@/components/admin/form/form-ui"
import {
  ErrorText,
  HelpText,
  LABEL_CLASS,
} from "@/components/admin/schema-form/widgets/field-shell"
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
import { Input } from "@/components/ui/input"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { LegalPageDto } from "@/lib/schemas/api/legal-pages"
import { legalSlug } from "@/lib/schemas/api/legal-pages"
import { previewHref } from "@/lib/schemas/api/preview"
import { cn } from "@/lib/utils"
import { legalEditorMeta } from "@/templates/legal/editor-meta"
import { legalTemplate } from "@/templates/legal/schema"

/** Query key of the legal pages list (Pages › Legal pages). */
export const LEGAL_PAGES_KEY = ["legal-pages"] as const

/** Draft editor for one legal page, its title and address, and delete. */
export function LegalPageEditor({ id }: { id: string }) {
  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const canDelete = usePermission({ page: ["delete"] })
  const queryKey = [...LEGAL_PAGES_KEY, id] as const
  // Once deleted, nothing may load the record again (it would 404).
  const [deleted, setDeleted] = useState(false)
  const record = useQuery({
    queryKey,
    queryFn: () => unwrap(api["legal-pages"][":id"].$get({ param: { id } })),
    enabled: !deleted,
  })
  const param = { id }
  // A title or address change bumps the record version; the editor keeps the
  // version it loaded, so it is remounted from the updated cache.
  const [epoch, setEpoch] = useState(0)
  if (deleted)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Legal page deleted. Returning to all pages…
      </p>
    )
  return (
    <VersionedEditor<LegalPageDto>
      key={epoch}
      title={record.data?.title ?? "Legal page"}
      description="Shown at its own address and linked from the footer once published."
      backHref="/admin/pages"
      backLabel="All pages"
      path={record.data?.path}
      queryKey={queryKey}
      load={() => unwrap(api["legal-pages"][":id"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api["legal-pages"][":id"].draft.$put({
            param,
            json: { draft, version },
          })
        )
      }
      publish={(version) =>
        unwrap(
          api["legal-pages"][":id"].publish.$post({ param, json: { version } })
        )
      }
      restore={(revisionId, version) =>
        unwrap(
          api["legal-pages"][":id"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={legalTemplate}
      meta={legalEditorMeta}
      revisions={{ entity: "legal-page", id }}
      previewHref={previewHref("legal-page", id)}
      publicHref={record.data?.path}
      canEdit={canEdit}
      canPublish={canPublish}
      actions={
        canDelete && record.data ? (
          <DeleteLegalPage
            page={record.data}
            onDeleted={() => setDeleted(true)}
          />
        ) : null
      }
      aside={(ctx: EditorActionContext<LegalPageDto>) =>
        record.data ? (
          <DetailsCard
            page={record.data}
            canEdit={canEdit}
            flush={ctx.flush}
            version={ctx.version}
            showAllErrors={ctx.showAllErrors}
            onChanged={() => setEpoch((n) => n + 1)}
          />
        ) : null
      }
    />
  )
}

/** Thrown when pending edits could not be saved before a title/address change. */
class UnsavedChangesError extends Error {
  constructor(readonly invalid: boolean) {
    super("Unsaved changes")
  }
}

function DetailsCard({
  page,
  canEdit,
  flush,
  version,
  showAllErrors,
  onChanged,
}: {
  page: LegalPageDto
  canEdit: boolean
  /** Saves pending editor changes; false when invalid or failed. */
  flush: () => Promise<boolean>
  /** The editor's current record version (after any save it just made). */
  version: () => number
  /** Marks the editor's invalid fields; true when there were any. */
  showAllErrors: () => boolean
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(page.title)
  const [slug, setSlug] = useState(page.slug)
  const [error, setError] = useState<string | null>(null)
  const change = useMutation({
    mutationFn: async () => {
      // The editor remounts after the change and reloads from the cache: an
      // unsaved edit would be lost, so save it first.
      if (!(await flush())) throw new UnsavedChangesError(showAllErrors())
      return unwrap(
        api["legal-pages"][":id"].meta.$patch({
          param: { id: page.id },
          json: {
            version: version(),
            ...(title !== page.title ? { title } : {}),
            ...(slug !== page.slug ? { slug } : {}),
          },
        })
      )
    },
    onSuccess: (dto) => {
      queryClient.setQueryData([...LEGAL_PAGES_KEY, page.id], dto)
      void queryClient.invalidateQueries({ queryKey: LEGAL_PAGES_KEY })
      toast.success("Saved", {
        description:
          dto.slug !== page.slug
            ? `The page is now at ${dto.path}.`
            : "The title was updated.",
      })
      onChanged()
    },
    onError: (err) => {
      if (err instanceof UnsavedChangesError)
        setError(
          err.invalid
            ? "Save your changes first: fix the fields marked in red, then change these."
            : "Save your changes first, then change these."
        )
      else if (
        err instanceof ApiError &&
        err.isConflict &&
        err.fieldErrors.slug
      )
        setError(err.fieldErrors.slug[0])
      else if (err instanceof ApiError && err.isConflict)
        setError("The page changed meanwhile. Reload the page and try again.")
      else setError(errorMessage(err))
    },
  })
  const slugCheck = legalSlug.safeParse(slug)
  const slugProblem = slugCheck.success
    ? null
    : slugCheck.error.issues[0].message
  const titleProblem = title.trim() ? null : "Enter a title"
  const message = error ?? slugProblem ?? titleProblem
  const unchanged = title === page.title && slug === page.slug
  return (
    <FormCard
      id="details"
      title="Title and address"
      description="The title is the footer link. Changing the address of a published page moves it at once and leaves a redirect from the old one."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="legal-title" className={LABEL_CLASS}>
            Title
          </label>
          <Input
            id="legal-title"
            value={title}
            maxLength={80}
            className={ADMIN_CONTROL}
            disabled={!canEdit || change.isPending}
            onChange={(event) => {
              setTitle(event.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="legal-slug" className={LABEL_CLASS}>
            Address
          </label>
          <HelpText id="legal-slug-help">
            The page lives at / followed by this, e.g. /cookie-policy.
          </HelpText>
          <div className="relative min-w-0">
            {/* Muted text on the dark input tint falls under 4.5:1 (axe): lifted. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground dark:text-foreground/80"
            >
              /
            </span>
            <Input
              id="legal-slug"
              value={slug}
              className={cn(ADMIN_CONTROL, "pl-6")}
              disabled={!canEdit || change.isPending}
              aria-invalid={!!message}
              aria-describedby={
                message ? "legal-slug-help legal-slug-error" : "legal-slug-help"
              }
              onChange={(event) => {
                setSlug(event.target.value)
                setError(null)
              }}
            />
          </div>
        </div>
        {message ? (
          <ErrorText id="legal-slug-error">{message}</ErrorText>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 self-start rounded-xl px-4 font-semibold pointer-coarse:h-11"
            disabled={
              unchanged || !!slugProblem || !!titleProblem || change.isPending
            }
            onClick={() => change.mutate()}
          >
            Save title and address
          </Button>
        ) : null}
      </div>
    </FormCard>
  )
}

function DeleteLegalPage({
  page,
  onDeleted,
}: {
  page: LegalPageDto
  onDeleted: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () =>
      unwrap(api["legal-pages"][":id"].$delete({ param: { id: page.id } })),
    onSuccess: async () => {
      toast.success(`${page.title} deleted`)
      onDeleted()
      // Drop the deleted record first so nothing refetches it (404).
      queryClient.removeQueries({ queryKey: [...LEGAL_PAGES_KEY, page.id] })
      await queryClient.invalidateQueries({ queryKey: LEGAL_PAGES_KEY })
      router.push("/admin/pages")
    },
    onError: (err) => {
      setOpen(false)
      toast.error("Not deleted", { description: errorMessage(err) })
    },
  })
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={cn(EDITOR_ACTION, "text-destructive hover:text-destructive")}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {page.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The page {page.path} and its footer link disappear from the site.
              Links to it will show “not found”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
