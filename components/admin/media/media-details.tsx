"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, FileText } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { type RefObject, useRef, useState } from "react"
import { toast } from "sonner"

import { ADMIN_TEXTAREA } from "@/components/admin/form/form-ui"
import { FORM_ACTION } from "@/components/admin/page-header"
import { FieldShell } from "@/components/admin/schema-form/widgets/field-shell"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import {
  ACCEPTED_IMAGE_TYPES,
  MEDIA_ALT_MAX,
  type MediaItem,
  type MediaUsage,
} from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

import { FocalPointPicker } from "./focal-point"
import {
  DRIVER_LABELS,
  formatBytes,
  isRaster,
  mediaName,
  typeLabel,
} from "./format"
import { replaceMediaFile } from "./upload-request"
import { useMediaItem } from "./use-media-item"

/**
 * Buttons that keep focus while unavailable (WCAG 2.4.3): aria-disabled
 * instead of disabled, and the handlers check the same condition.
 */
const SOFT_DISABLED =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:translate-y-0"

type Point = { x: number; y: number }
const focalOf = (item: MediaItem): Point | null =>
  item.focalX !== null && item.focalY !== null
    ? { x: item.focalX, y: item.focalY }
    : null

/**
 * Right-hand sheet with one file's details (spec §8.1: alt text, focal
 * point, usages, replace, delete). After a delete the file's card is gone,
 * so focus goes to `afterDelete` instead of the opener.
 */
export function MediaDetails({
  id,
  onClose,
  afterDelete,
}: {
  id: string | null
  onClose: () => void
  afterDelete?: RefObject<HTMLElement | null>
}) {
  const item = useMediaItem(id)
  const deleted = useRef(false)
  return (
    <Sheet
      open={id !== null}
      onOpenChange={(open) => {
        if (open) return
        onClose()
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 bg-card sm:max-w-lg"
        finalFocus={() => {
          const wasDeleted = deleted.current
          deleted.current = false
          return wasDeleted ? (afterDelete?.current ?? true) : true
        }}
      >
        {item.data ? (
          <DetailsBody
            key={item.data.id}
            item={item.data}
            onDeleted={() => {
              deleted.current = true
              onClose()
            }}
          />
        ) : (
          <>
            <SheetHeader className="border-b pr-12">
              <SheetTitle className="text-lg font-semibold">
                {item.isError ? "File not found" : "Loading…"}
              </SheetTitle>
              <SheetDescription>
                {item.isError
                  ? errorMessage(item.error)
                  : "Fetching the file's details."}
              </SheetDescription>
            </SheetHeader>
            {item.isError ? null : (
              <div className="flex flex-col gap-4 p-4">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** The image at its own proportions (next/image from the same-origin URL). */
function Preview({ item }: { item: MediaItem }) {
  if (!item.mime.startsWith("image/"))
    return (
      <span className="flex h-32 items-center justify-center rounded-xl border bg-muted/40">
        <FileText aria-hidden className="size-10 text-muted-foreground" />
      </span>
    )
  return item.width && item.height ? (
    <Image
      src={item.url}
      alt=""
      width={item.width}
      height={item.height}
      sizes="(min-width: 640px) 450px, 90vw"
      className="h-auto max-h-56 w-auto max-w-full self-start rounded-xl border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[16px_16px]"
    />
  ) : (
    <span className="relative h-48 rounded-xl border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[16px_16px]">
      <Image
        src={item.url}
        alt=""
        fill
        sizes="(min-width: 640px) 450px, 90vw"
        className="object-contain"
      />
    </span>
  )
}

function UsageLink({ usage }: { usage: MediaUsage }) {
  return usage.href ? (
    <Link
      href={usage.href}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {usage.label}
    </Link>
  ) : (
    <span className="font-medium">{usage.label}</span>
  )
}

function DetailsBody({
  item,
  onDeleted,
}: {
  item: MediaItem
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ media: ["update"] })
  const canDelete = usePermission({ media: ["delete"] })
  const [alt, setAlt] = useState(item.alt)
  const [focal, setFocal] = useState<Point | null>(focalOf(item))
  // A saved or replaced file comes back with a new updatedAt: show what was
  // stored (the alt text cleaned, the focal point reset by a replace). The
  // body stays mounted, so focus stays on the button that was used.
  const [shown, setShown] = useState(item.updatedAt)
  if (shown !== item.updatedAt) {
    setShown(item.updatedAt)
    setAlt(item.alt)
    setFocal(focalOf(item))
  }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null)
  const [replaceError, setReplaceError] = useState<string | null>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const name = mediaName(item)
  const image = item.mime.startsWith("image/")
  const altId = `media-alt-${item.id}`

  const usages = useQuery({
    queryKey: ["media", "usages", item.id],
    queryFn: () =>
      unwrap(api.media[":id"].usages.$get({ param: { id: item.id } })),
  })

  const accept = (next: MediaItem) => {
    queryClient.setQueryData(["media", "item", next.id], next)
    void queryClient.invalidateQueries({ queryKey: ["media", "list"] })
  }

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.media[":id"].$patch({
          param: { id: item.id },
          json: { alt, focal },
        })
      ),
    onSuccess: (next) => {
      accept(next)
      toast.success("File details saved.")
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      unwrap(api.media[":id"].$delete({ param: { id: item.id } })),
    onSuccess: () => {
      setConfirmDelete(false)
      queryClient.removeQueries({ queryKey: ["media", "item", item.id] })
      void queryClient.invalidateQueries({ queryKey: ["media", "list"] })
      toast.success("File deleted.")
      onDeleted()
    },
    onError: () => setConfirmDelete(false),
  })

  const replace = async (file: File) => {
    setReplaceProgress(0)
    setReplaceError(null)
    try {
      accept(
        await replaceMediaFile(item.id, file, {
          onProgress: setReplaceProgress,
        })
      )
      toast.success("File replaced.")
    } catch (err) {
      setReplaceError(errorMessage(err))
    } finally {
      setReplaceProgress(null)
    }
  }

  const dirty =
    alt !== item.alt || JSON.stringify(focal) !== JSON.stringify(focalOf(item))
  const canSave = dirty && !save.isPending
  const replacing = replaceProgress !== null
  const blocked =
    remove.error instanceof ApiError && remove.error.isConflict
      ? ((remove.error.current as { usages?: MediaUsage[] } | undefined)
          ?.usages ?? [])
      : null

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="text-lg font-semibold wrap-anywhere">
          {name}
        </SheetTitle>
        <SheetDescription>
          {typeLabel(item.mime)} · {formatBytes(item.size)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        {image && isRaster(item.mime) && item.width && item.height ? (
          <FocalPointPicker
            src={item.url}
            width={item.width}
            height={item.height}
            value={focal}
            onChange={setFocal}
            disabled={!canUpdate}
          />
        ) : (
          <Preview item={item} />
        )}

        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Type</dt>
          <dd>{typeLabel(item.mime)}</dd>
          <dt className="text-muted-foreground">Size</dt>
          <dd>{formatBytes(item.size)}</dd>
          {item.width && item.height ? (
            <>
              <dt className="text-muted-foreground">Dimensions</dt>
              <dd>
                {item.width} × {item.height} px
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Storage</dt>
          <dd>{DRIVER_LABELS[item.driver]}</dd>
          <dt className="text-muted-foreground">Added</dt>
          <dd>
            <time dateTime={item.createdAt}>
              {formatDateTime(item.createdAt)}
            </time>
          </dd>
        </dl>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-6 items-center gap-1.5 self-start text-sm font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
        >
          Open file
          <ExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>

        <FieldShell
          id={altId}
          label="Alternative text"
          help="Describes the image for people who cannot see it. Leave it empty for decorative images."
          extra={
            <p
              id={`${altId}-count`}
              className="text-right text-xs text-muted-foreground tabular-nums"
            >
              {alt.length} / {MEDIA_ALT_MAX}
            </p>
          }
        >
          <Textarea
            id={altId}
            className={ADMIN_TEXTAREA}
            value={alt}
            maxLength={MEDIA_ALT_MAX}
            readOnly={!canUpdate}
            rows={3}
            aria-describedby={`${altId}-help ${altId}-count`}
            onChange={(e) => setAlt(e.target.value)}
          />
        </FieldShell>
        {save.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(save.error)}
          </p>
        ) : null}

        <section
          aria-labelledby={`usages-${item.id}`}
          className="flex flex-col gap-2"
        >
          <h3 id={`usages-${item.id}`} className="text-sm font-semibold">
            Used in
          </h3>
          {usages.isPending ? (
            <Skeleton className="h-6 w-40" />
          ) : usages.isError ? (
            <p className="text-sm text-destructive">
              {errorMessage(usages.error)}
            </p>
          ) : usages.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not used anywhere yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {usages.data.items.map((usage) => (
                <li
                  key={`${usage.entityType}:${usage.entityId}:${usage.field}`}
                >
                  <UsageLink usage={usage} />{" "}
                  <span className="text-xs text-muted-foreground">
                    ({usage.field})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {replaceError ? (
          <p role="alert" className="text-sm text-destructive">
            {replaceError}
          </p>
        ) : null}
        {remove.isError ? (
          <div
            role="alert"
            className="bg-danger-soft/40 flex flex-col gap-2 rounded-xl border border-destructive/40 p-3 text-sm"
          >
            <p className="font-medium">{errorMessage(remove.error)}</p>
            {blocked && blocked.length > 0 ? (
              <ul aria-label="Where it is used" className="list-disc pl-5">
                {blocked.map((u) => (
                  <li key={`${u.entityType}:${u.entityId}:${u.field}`}>
                    <UsageLink usage={u} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {canUpdate || canDelete ? (
        <SheetFooter className="flex-row flex-wrap justify-between gap-2 border-t">
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              className={FORM_ACTION}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          {canUpdate ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn(FORM_ACTION, SOFT_DISABLED)}
                aria-disabled={replacing || undefined}
                onClick={() => {
                  if (!replacing) replaceInput.current?.click()
                }}
              >
                {replacing
                  ? `Replacing… ${Math.round(replaceProgress * 100)}%`
                  : "Replace file…"}
              </Button>
              <input
                ref={replaceInput}
                type="file"
                hidden
                tabIndex={-1}
                accept={image ? ACCEPTED_IMAGE_TYPES : "application/pdf"}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) void replace(file)
                }}
              />
              <Button
                type="button"
                className={cn(FORM_ACTION, SOFT_DISABLED)}
                aria-disabled={!canSave || undefined}
                onClick={() => {
                  if (canSave) save.mutate()
                }}
              >
                {save.isPending ? "Saving…" : "Save details"}
              </Button>
            </div>
          ) : null}
        </SheetFooter>
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              “{name}” is removed from the library and from storage. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              className={SOFT_DISABLED}
              aria-disabled={remove.isPending || undefined}
              onClick={() => {
                if (!remove.isPending) remove.mutate()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
