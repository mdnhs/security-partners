"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, FileText } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { type RefObject, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { useGuardedClose } from "@/components/admin/editor/discard-changes"
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
import { Checkbox } from "@/components/ui/checkbox"
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
import { useAdminSession } from "@/components/admin/session-provider"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import {
  ACCEPTED_IMAGE_TYPES,
  MEDIA_ALT_MAX,
  MEDIA_CAPTION_MAX,
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
 * Right-hand sheet with one file's details (spec §8.1: alt text, decorative
 * flag, caption, focal point, usages, replace, delete). After a delete the file's card is gone,
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
  // While the sheet closes (id null) it keeps showing the last file, so the
  // exit animation never flashes "Loading…" (nor refetches a deleted file).
  const [last, setLast] = useState<MediaItem | null>(null)
  if (item.data && item.data !== last) setLast(item.data)
  const shown = item.data ?? (id === null ? last : null)
  const deleted = useRef(false)
  // Unsaved details (reported by the body): closing asks.
  const [dirty, setDirty] = useState(false)
  const close = useGuardedClose({
    dirty: dirty && id !== null,
    onClose,
    title: "Discard your changes to this file?",
    description:
      "The details you changed are not saved. The file keeps its current details.",
  })
  return (
    <Sheet open={id !== null} onOpenChange={close.onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 bg-card sm:max-w-lg"
        finalFocus={() => {
          const wasDeleted = deleted.current
          deleted.current = false
          return wasDeleted ? (afterDelete?.current ?? true) : true
        }}
      >
        {/* Inside the popup: Esc closes only the confirm. */}
        {close.guard}
        {shown ? (
          <DetailsBody
            key={shown.id}
            item={shown}
            onDirtyChange={setDirty}
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
      className="inline-flex min-h-6 items-center font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
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
  onDirtyChange,
}: {
  item: MediaItem
  onDeleted: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ media: ["update"] })
  const canDelete = usePermission({ media: ["delete"] })
  const canCreate = usePermission({ media: ["create"] })
  const { user } = useAdminSession()
  // Uploaders describe their own files (alt text, caption, focal point; the API
  // allows the same); replacing and deleting need media:update/delete.
  const canDescribe = canUpdate || (canCreate && item.createdBy === user.id)
  const [alt, setAlt] = useState(item.alt)
  const [decorative, setDecorative] = useState(item.isDecorative)
  const [caption, setCaption] = useState(item.caption)
  const [focal, setFocal] = useState<Point | null>(focalOf(item))
  // A saved or replaced file comes back with a new updatedAt: show what was
  // stored (the alt text cleaned, the focal point reset by a replace). The
  // body stays mounted, so focus stays on the button that was used.
  const [shown, setShown] = useState(item.updatedAt)
  if (shown !== item.updatedAt) {
    setShown(item.updatedAt)
    setAlt(item.alt)
    setDecorative(item.isDecorative)
    setCaption(item.caption)
    setFocal(focalOf(item))
  }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null)
  const [replaceError, setReplaceError] = useState<string | null>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const name = mediaName(item)
  const image = item.mime.startsWith("image/")
  const altId = `media-alt-${item.id}`
  const captionId = `media-caption-${item.id}`

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
          json: { alt, isDecorative: decorative, caption, focal },
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
    alt !== item.alt ||
    decorative !== item.isDecorative ||
    caption !== item.caption ||
    JSON.stringify(focal) !== JSON.stringify(focalOf(item))
  const canSave = dirty && !save.isPending
  useEffect(
    () => onDirtyChange(dirty && canDescribe),
    [dirty, canDescribe, onDirtyChange]
  )
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
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
            disabled={!canDescribe}
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

        {image ? (
          <label
            className={cn(
              "-mx-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60",
              !canDescribe && "cursor-default opacity-70 hover:bg-transparent"
            )}
          >
            {/* The wrapping label names the checkbox (Base UI links it). */}
            <Checkbox
              className="mt-0.5"
              checked={decorative}
              disabled={!canDescribe}
              aria-describedby={`${altId}-decorative-help`}
              onCheckedChange={(checked) => setDecorative(checked === true)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm leading-tight font-medium">
                Decorative image (no alt text needed)
              </span>
              <span
                id={`${altId}-decorative-help`}
                aria-hidden
                className="text-xs leading-relaxed text-muted-foreground"
              >
                For images that add nothing to the text, such as patterns and
                dividers.
              </span>
            </span>
          </label>
        ) : null}

        <FieldShell
          id={altId}
          label="Alternative text"
          optional={image && decorative}
          help={
            image && decorative
              ? "Not needed for a decorative image. Any text here is kept."
              : "Describes the image for people who cannot see it."
          }
          extra={
            <p
              id={`${altId}-count`}
              className="text-right text-xs text-muted-foreground tabular-nums"
            >
              {alt.length}/{MEDIA_ALT_MAX}
            </p>
          }
        >
          <Textarea
            id={altId}
            className={ADMIN_TEXTAREA}
            value={alt}
            maxLength={MEDIA_ALT_MAX}
            readOnly={!canDescribe}
            rows={3}
            aria-describedby={`${altId}-help ${altId}-count`}
            onChange={(e) => setAlt(e.target.value)}
          />
        </FieldShell>

        <FieldShell
          id={captionId}
          label="Caption"
          optional
          extra={
            <p
              id={`${captionId}-count`}
              className="text-right text-xs text-muted-foreground tabular-nums"
            >
              {caption.length}/{MEDIA_CAPTION_MAX}
            </p>
          }
        >
          <Textarea
            id={captionId}
            className={ADMIN_TEXTAREA}
            value={caption}
            maxLength={MEDIA_CAPTION_MAX}
            readOnly={!canDescribe}
            rows={2}
            aria-describedby={`${captionId}-count`}
            onChange={(e) => setCaption(e.target.value)}
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

      {canDescribe || canDelete ? (
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
          {canDescribe ? (
            <div className="flex flex-wrap gap-2">
              {canUpdate ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(FORM_ACTION, SOFT_DISABLED)}
                    aria-disabled={replacing || undefined}
                    onClick={() => {
                      if (!replacing) replaceInput.current?.click()
                    }}
                  >
                    Replace file…
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
                </>
              ) : null}
              <Button
                type="button"
                className={cn(FORM_ACTION, SOFT_DISABLED)}
                aria-disabled={!canSave || undefined}
                onClick={() => {
                  if (canSave) save.mutate()
                }}
              >
                Save details
              </Button>
            </div>
          ) : null}
          {replacing ? (
            <div
              role="progressbar"
              aria-label="Replacing the file"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(replaceProgress * 100)}
              className="flex w-full flex-col gap-1 text-xs text-muted-foreground"
            >
              <span className="tabular-nums">
                Replacing the file… {Math.round(replaceProgress * 100)}%
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full bg-primary transition-[width] motion-reduce:transition-none"
                  style={{ width: `${replaceProgress * 100}%` }}
                />
              </span>
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
