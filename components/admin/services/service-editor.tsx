"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { EDITOR_ACTION } from "@/components/admin/editor/editor-layout"
import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { ADMIN_CONTROL, FormCard } from "@/components/admin/form/form-ui"
import {
  ErrorText,
  HelpText,
  LABEL_CLASS,
} from "@/components/admin/schema-form/widgets/field-shell"
import {
  AlertDialog,
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
import type { ServiceDto } from "@/lib/schemas/api/services"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { serviceContent } from "@/lib/schemas/content/service"

import { serviceEditorMeta } from "./service-meta"

/** Draft editor for one service + its address (slug) and delete (master 4.6). */
export function ServiceEditor({ id }: { id: string }) {
  const canEdit = usePermission({ service: ["update"] })
  const canPublish = usePermission({ service: ["publish"] })
  const canDelete = usePermission({ service: ["delete"] })
  const queryKey = ["services", id] as const
  // Once deleted, nothing may load the record again (it would 404).
  const [deleted, setDeleted] = useState(false)
  const record = useQuery({
    queryKey,
    queryFn: () => unwrap(api.services[":id"].$get({ param: { id } })),
    enabled: !deleted,
  })
  const param = { id }
  // A slug change bumps the record version; the editor keeps the version it
  // loaded, so it is remounted from the updated cache (else the next save 409s).
  const [epoch, setEpoch] = useState(0)
  if (deleted)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Service deleted. Returning to all services…
      </p>
    )
  return (
    <VersionedEditor<ServiceDto>
      key={epoch}
      title={record.data?.title ?? "Service"}
      backHref="/admin/services"
      backLabel="All services"
      queryKey={queryKey}
      load={() => unwrap(api.services[":id"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api.services[":id"].draft.$put({ param, json: { draft, version } })
        )
      }
      publish={(version) =>
        unwrap(api.services[":id"].publish.$post({ param, json: { version } }))
      }
      restore={(revisionId, version) =>
        unwrap(
          api.services[":id"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={serviceContent}
      meta={serviceEditorMeta}
      revisions={{ entity: "service", id }}
      previewHref={previewHref("service", id)}
      publicHref={record.data ? `/services/${record.data.slug}` : undefined}
      canEdit={canEdit}
      canPublish={canPublish}
      actions={
        canDelete && record.data ? (
          <DeleteService
            service={record.data}
            onDeleted={() => setDeleted(true)}
          />
        ) : null
      }
      aside={
        record.data ? (
          <SlugCard
            service={record.data}
            canEdit={canEdit}
            onChanged={() => setEpoch((n) => n + 1)}
          />
        ) : null
      }
    />
  )
}

function SlugCard({
  service,
  canEdit,
  onChanged,
}: {
  service: ServiceDto
  canEdit: boolean
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState(service.slug)
  const [error, setError] = useState<string | null>(null)
  const change = useMutation({
    mutationFn: () =>
      unwrap(
        api.services[":id"].slug.$patch({
          param: { id: service.id },
          json: { slug, version: service.version },
        })
      ),
    onSuccess: (dto) => {
      queryClient.setQueryData(["services", service.id], dto)
      toast.success("Address changed", {
        description: `The page is now at /services/${dto.slug}.`,
      })
      onChanged()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isConflict && err.fieldErrors.slug)
        setError(err.fieldErrors.slug[0])
      else if (err instanceof ApiError && err.isConflict)
        setError(
          "The service changed meanwhile. Reload the page and try again."
        )
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
        <label htmlFor="service-slug" className={LABEL_CLASS}>
          Address
        </label>
        <HelpText id="service-slug-help">
          The page lives at /services/ followed by this.
        </HelpText>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
            >
              /services/
            </span>
            <Input
              id="service-slug"
              value={slug}
              className={cn(ADMIN_CONTROL, "pl-[5.25rem]")}
              disabled={!canEdit}
              aria-invalid={!!message}
              aria-describedby={
                message
                  ? "service-slug-help service-slug-error"
                  : "service-slug-help"
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
              disabled={!valid || slug === service.slug || change.isPending}
              onClick={() => change.mutate()}
            >
              Change address
            </Button>
          ) : null}
        </div>
        {message ? (
          <ErrorText id="service-slug-error">{message}</ErrorText>
        ) : null}
      </div>
    </FormCard>
  )
}

function DeleteService({
  service,
  onDeleted,
}: {
  service: ServiceDto
  onDeleted: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        api.services[":id"].$delete({
          param: { id: service.id },
          query: { version: String(service.version) },
        })
      ),
    onSuccess: async () => {
      toast.success(`${service.title} deleted`)
      onDeleted()
      // Drop the deleted record first so nothing refetches it (404).
      queryClient.removeQueries({ queryKey: ["services", service.id] })
      await queryClient.invalidateQueries({ queryKey: ["services"] })
      router.push("/admin/services")
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
            <AlertDialogTitle>Delete {service.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The card and the page /services/{service.slug} disappear from the
              site. Links to it will show “not found”.
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
              Delete service
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
