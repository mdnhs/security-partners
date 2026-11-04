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
import { cn } from "@/lib/utils"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { previewHref } from "@/lib/schemas/api/preview"
import type { JobDto } from "@/lib/schemas/api/jobs"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { jobContent } from "@/lib/schemas/content/job"

import { jobEditorMeta } from "./job-meta"

/** Draft editor for one job opening + its address (slug) and delete. */
export function JobEditor({ id }: { id: string }) {
  const canEdit = usePermission({ job: ["update"] })
  const canPublish = usePermission({ job: ["publish"] })
  const canDelete = usePermission({ job: ["delete"] })
  const queryKey = ["jobs", id] as const
  // Once deleted, nothing may load the record again (it would 404).
  const [deleted, setDeleted] = useState(false)
  const record = useQuery({
    queryKey,
    queryFn: () => unwrap(api.jobs[":id"].$get({ param: { id } })),
    enabled: !deleted,
  })
  const param = { id }
  // A slug change bumps the record version; the editor keeps the version it
  // loaded, so it is remounted from the updated cache (else the next save 409s).
  const [epoch, setEpoch] = useState(0)
  if (deleted)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Job deleted. Returning to all jobs…
      </p>
    )
  return (
    <VersionedEditor<JobDto>
      key={epoch}
      title={record.data?.title ?? "Job"}
      backHref="/admin/careers"
      backLabel="All jobs"
      path={record.data ? `/careers/${record.data.slug}` : undefined}
      queryKey={queryKey}
      load={() => unwrap(api.jobs[":id"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(api.jobs[":id"].draft.$put({ param, json: { draft, version } }))
      }
      publish={(version) =>
        unwrap(api.jobs[":id"].publish.$post({ param, json: { version } }))
      }
      restore={(revisionId, version) =>
        unwrap(
          api.jobs[":id"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={jobContent}
      meta={jobEditorMeta}
      revisions={{ entity: "job", id }}
      previewHref={previewHref("job", id)}
      publicHref={record.data ? `/careers/${record.data.slug}` : undefined}
      canEdit={canEdit}
      canPublish={canPublish}
      actions={
        <>
          {canDelete && record.data ? (
            <DeleteJob job={record.data} onDeleted={() => setDeleted(true)} />
          ) : null}
        </>
      }
      aside={(ctx: EditorActionContext<JobDto>) =>
        record.data ? (
          <SlugCard
            job={record.data}
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

/** Thrown when pending edits could not be saved before an address change. */
class UnsavedChangesError extends Error {
  constructor(readonly invalid: boolean) {
    super("Unsaved changes")
  }
}

function SlugCard({
  job,
  canEdit,
  flush,
  version,
  showAllErrors,
  onChanged,
}: {
  job: JobDto
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
  const [slug, setSlug] = useState(job.slug)
  const [error, setError] = useState<string | null>(null)
  const change = useMutation({
    mutationFn: async () => {
      // The editor remounts after the move and reloads from the cache: an
      // unsaved edit would be lost, so save it first (ledger P04-10).
      if (!(await flush())) throw new UnsavedChangesError(showAllErrors())
      return unwrap(
        api.jobs[":id"].slug.$patch({
          param: { id: job.id },
          json: { slug, version: version() },
        })
      )
    },
    onSuccess: (dto) => {
      queryClient.setQueryData(["jobs", job.id], dto)
      toast.success("Address changed", {
        description: `The page is now at /careers/${dto.slug}.`,
      })
      onChanged()
    },
    onError: (err) => {
      if (err instanceof UnsavedChangesError)
        setError(
          err.invalid
            ? "Save your changes first: fix the fields marked in red, then change the address."
            : "Save your changes first, then change the address."
        )
      else if (
        err instanceof ApiError &&
        err.isConflict &&
        err.fieldErrors.slug
      )
        setError(err.fieldErrors.slug[0])
      else if (err instanceof ApiError && err.isConflict)
        setError("The job changed meanwhile. Reload the page and try again.")
      else setError(errorMessage(err))
    },
  })
  const valid = SLUG_PATTERN.test(slug)
  const message =
    error ?? (valid ? null : "Lowercase letters, numbers and single hyphens.")
  return (
    <FormCard
      id="slug"
      title="Page address"
      description="Changing it moves the live page immediately."
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="job-slug" className={LABEL_CLASS}>
          Address
        </label>
        <HelpText id="job-slug-help">
          The page lives at /careers/ followed by this.
        </HelpText>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            {/* Muted text on the dark input tint falls under 4.5:1 (axe): lifted. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground dark:text-foreground/80"
            >
              /careers/
            </span>
            <Input
              id="job-slug"
              value={slug}
              className={cn(ADMIN_CONTROL, "pl-[4.6rem]")}
              // Locked while the move runs (it saves pending edits first).
              disabled={!canEdit || change.isPending}
              aria-invalid={!!message}
              aria-describedby={
                message ? "job-slug-help job-slug-error" : "job-slug-help"
              }
              onChange={(event) => {
                setSlug(event.target.value)
                setError(null)
              }}
            />
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl px-4 font-semibold pointer-coarse:h-11"
              disabled={!valid || slug === job.slug || change.isPending}
              onClick={() => change.mutate()}
            >
              Change address
            </Button>
          ) : null}
        </div>
        {message ? <ErrorText id="job-slug-error">{message}</ErrorText> : null}
      </div>
    </FormCard>
  )
}

function DeleteJob({ job, onDeleted }: { job: JobDto; onDeleted: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        api.jobs[":id"].$delete({
          param: { id: job.id },
          query: { version: String(job.version) },
        })
      ),
    onSuccess: async () => {
      toast.success(`${job.title} deleted`)
      onDeleted()
      // Drop the deleted record first so nothing refetches it (404).
      queryClient.removeQueries({ queryKey: ["jobs", job.id] })
      await queryClient.invalidateQueries({ queryKey: ["jobs"] })
      router.push("/admin/careers")
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
            <AlertDialogTitle>Delete {job.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The role and its page /careers/{job.slug} disappear from the site;
              old links go to /careers. Applications already received are kept.
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
              Delete job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
