"use client"

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { ImageOff, Search, Upload } from "lucide-react"
import Image from "next/image"
import { useEffect, useId, useRef, useState } from "react"

import { useOptionalAdminSession } from "@/components/admin/session-provider"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { hasPermission } from "@/lib/auth/permissions"
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_LOTTIE_TYPES,
  isLottieMime,
  MEDIA_ALT_MAX,
  type MediaItem,
} from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

import { mediaName } from "./format"
import { LottieTile } from "./lottie-tile"
import { uploadMediaFile } from "./upload-request"
import { useAnnouncer } from "./uploader"

const PAGE_SIZE = 24
const IMAGE_TYPES = new Set(ACCEPTED_IMAGE_TYPES.split(","))
const NOT_AN_IMAGE =
  "This file is not an image this field can use. Upload a JPEG, PNG, WebP, AVIF or SVG image."

/** What a picker offers: images (every image field) or Lottie animations. */
export type PickerKind = "image" | "lottie"

const PICKER_COPY = {
  image: {
    description:
      "Images in the media library. Upload a new one if it is not there yet.",
    search: "Search images",
    upload: "Upload new image",
    accept: ACCEPTED_IMAGE_TYPES,
    wrongFile: NOT_AN_IMAGE,
    noMatch: (q: string) => `No images match “${q}”.`,
    empty: "The media library has no images yet.",
    list: "Images",
    use: "Use this image",
    // An image field takes images only: anything else is refused here
    // (the input's accept list is only a hint to the file chooser).
    fileOk: (file: File) => IMAGE_TYPES.has(file.type),
    itemOk: (item: MediaItem) => item.mime.startsWith("image/"),
  },
  lottie: {
    description:
      "Lottie animations in the media library. Upload a new one if it is not there yet.",
    search: "Search animations",
    upload: "Upload new animation",
    accept: ACCEPTED_LOTTIE_TYPES,
    wrongFile:
      "This file is not a Lottie animation. Upload a .json or .lottie file.",
    noMatch: (q: string) => `No animations match “${q}”.`,
    empty: "The media library has no Lottie animations yet.",
    list: "Animations",
    use: "Use this animation",
    fileOk: (file: File) => /\.(json|lottie)$/i.test(file.name),
    itemOk: (item: MediaItem) => isLottieMime(item.mime),
  },
} as const

/**
 * Buttons that keep focus while unavailable (WCAG 2.4.3): aria-disabled
 * instead of disabled, and the handler checks the same condition.
 */
const SOFT_DISABLED =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:translate-y-0"

type UploadState =
  | { name: string; progress: number; error?: undefined }
  | { name: string; error: string }

/**
 * Pick an image from the media library, or upload a new one (Phase 6).
 * Upload needs a session granting media:create; outside the admin shell
 * (shared widgets in tests) there is none, so there is no upload.
 * `kind="lottie"` offers Lottie animations instead (Settings › Logos).
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedId,
  title = "Choose an image",
  kind = "image",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: MediaItem) => void
  selectedId?: string | null
  title?: string
  kind?: PickerKind
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [chosen, setChosen] = useState<MediaItem | null>(null)
  const queryClient = useQueryClient()
  const adminSession = useOptionalAdminSession()
  const canUpload =
    !!adminSession && hasPermission(adminSession.roles, { media: ["create"] })
  const fileInput = useRef<HTMLInputElement>(null)
  const [upload, setUpload] = useState<UploadState | null>(null)
  const [uploadAlt, setUploadAlt] = useState("")
  const altId = useId()
  // Polite: start and finish only (the bar carries the percent).
  const [announcement, announce] = useAnnouncer()
  // The opening the announcement belongs to (none after a reopen).
  const [announcedFor, setAnnouncedFor] = useState<number | null>(null)
  const uploading = !!upload && "progress" in upload
  // Each opening starts fresh: no stale search, page or choice.
  const [wasOpen, setWasOpen] = useState(open)
  const [session, setSession] = useState(0)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSession((n) => n + 1)
      setQuery("")
      setPage(1)
      setChosen(null)
      setUpload(null)
      setUploadAlt("")
    }
  }
  // Which opening an upload belongs to: one that finishes after the dialog
  // was closed and opened again leaves the new opening alone.
  const openingRef = useRef(session)
  useEffect(() => {
    openingRef.current = session
  }, [session])
  // The debounced search is tagged with its opening, so a term typed in an
  // earlier opening never leaks into this one. Clearing applies at once.
  const tag = `${session}:`
  const debounced = useDebouncedValue(tag + query.trim(), 250)
  const q =
    query.trim() && debounced.startsWith(tag) ? debounced.slice(tag.length) : ""

  const result = useQuery({
    queryKey: ["media", "list", { q, page, kind }],
    queryFn: () =>
      unwrap(
        api.media.$get({
          query: {
            kind,
            q: q || undefined,
            page: String(page),
            pageSize: String(PAGE_SIZE),
          },
        })
      ),
    enabled: open,
    placeholderData: keepPreviousData,
  })
  const items = result.data?.items ?? []
  const pages = Math.max(1, Math.ceil((result.data?.total ?? 0) / PAGE_SIZE))
  const current = chosen?.id ?? selectedId ?? null

  const copy = PICKER_COPY[kind]
  const uploadFile = async (file: File) => {
    if (!copy.fileOk(file)) {
      setUpload({ name: file.name, error: copy.wrongFile })
      return
    }
    const opening = session
    const current = () => openingRef.current === opening
    setUpload({ name: file.name, progress: 0 })
    setAnnouncedFor(opening)
    announce(`Uploading ${file.name}…`)
    try {
      const item = await uploadMediaFile(file, {
        alt: uploadAlt.trim() || undefined,
        onProgress: (progress) => {
          if (current()) setUpload({ name: file.name, progress })
        },
      })
      await queryClient.invalidateQueries({ queryKey: ["media"] })
      if (!current()) return
      setUpload(null)
      setUploadAlt("")
      if (!copy.itemOk(item)) {
        // The server sniffs the bytes: a renamed PDF stays in the library
        // but never lands in an image (or animation) field.
        setUpload({ name: file.name, error: copy.wrongFile })
        return
      }
      // Newest first on page 1 with no search: the new image is in view.
      setQuery("")
      setPage(1)
      setChosen(item)
      announce(`${file.name} uploaded and selected.`)
    } catch (err) {
      if (current()) setUpload({ name: file.name, error: errorMessage(err) })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setChosen(null)
      }}
    >
      <DialogContent className="flex max-h-[min(90svh,720px)] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={copy.search}
            placeholder="Search by description or file name"
            className="pl-8"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </div>
        {canUpload ? (
          <div className="flex flex-wrap items-end gap-3">
            {/* Animations play aria-hidden beside the logo's own alt text. */}
            <div
              className={cn(
                "flex min-w-48 flex-1 flex-col gap-1",
                kind === "lottie" && "hidden"
              )}
            >
              <label htmlFor={altId} className="text-xs font-medium">
                Alternative text for the upload{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <Input
                id={altId}
                value={uploadAlt}
                maxLength={MEDIA_ALT_MAX}
                placeholder="Describe the image you upload"
                className="h-9 rounded-xl pointer-coarse:h-11"
                onChange={(event) => setUploadAlt(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-9 rounded-xl bg-card px-3 font-semibold pointer-coarse:h-11",
                SOFT_DISABLED
              )}
              aria-disabled={uploading || undefined}
              onClick={() => {
                if (!uploading) fileInput.current?.click()
              }}
            >
              <Upload aria-hidden />
              {copy.upload}
            </Button>
            <input
              ref={fileInput}
              type="file"
              hidden
              tabIndex={-1}
              accept={copy.accept}
              data-upload-input
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void uploadFile(file)
              }}
            />
            {upload && "progress" in upload ? (
              <div
                role="progressbar"
                aria-label={`Uploading ${upload.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(upload.progress * 100)}
                className="flex min-w-0 basis-full flex-col gap-1 text-xs text-muted-foreground"
              >
                <span className="flex min-w-0 gap-1">
                  <span className="truncate">Uploading {upload.name}…</span>{" "}
                  <span className="shrink-0 tabular-nums">
                    {Math.round(upload.progress * 100)}%
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-primary transition-[width] motion-reduce:transition-none"
                    style={{ width: `${upload.progress * 100}%` }}
                  />
                </span>
              </div>
            ) : upload?.error ? (
              <p
                role="alert"
                className="min-w-0 basis-full text-xs text-destructive"
              >
                <span className="sr-only">{upload.name}: </span>
                {upload.error}
              </p>
            ) : null}
            <p role="status" aria-label="Upload progress" className="sr-only">
              {announcedFor === session ? announcement : ""}
            </p>
          </div>
        ) : null}
        <div className="-mx-1 min-h-48 flex-1 overflow-y-auto px-1">
          {result.isError ? (
            <p
              role="alert"
              className="py-8 text-center text-sm text-destructive"
            >
              {errorMessage(result.error)}
            </p>
          ) : result.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <ImageOff aria-hidden className="size-6" />
              {q ? copy.noMatch(q) : copy.empty}
            </div>
          ) : (
            <ul
              aria-label={copy.list}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {items.map((item) => {
                const selected = item.id === current
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setChosen(item)}
                      onDoubleClick={() => {
                        onSelect(item)
                        onOpenChange(false)
                      }}
                      className={cn(
                        "group flex w-full flex-col gap-1.5 rounded-lg border p-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "border-primary ring-2 ring-primary"
                          : "hover:border-foreground/30"
                      )}
                    >
                      <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[16px_16px]">
                        {isLottieMime(item.mime) ? (
                          <LottieTile />
                        ) : (
                          <Image
                            src={item.url}
                            alt=""
                            fill
                            sizes="(min-width: 640px) 170px, 45vw"
                            className="object-contain"
                          />
                        )}
                      </span>
                      <span className="line-clamp-2 min-h-8 text-xs wrap-anywhere">
                        {item.alt || mediaName(item)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
          <Button
            type="button"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return
              onSelect(chosen)
              onOpenChange(false)
              setChosen(null)
            }}
          >
            {copy.use}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
