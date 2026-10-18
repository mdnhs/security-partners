"use client"

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { ImageOff, Search, Upload } from "lucide-react"
import Image from "next/image"
import { useRef, useState } from "react"

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
import { ACCEPTED_IMAGE_TYPES, type MediaItem } from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

import { mediaName } from "./format"
import { uploadMediaFile } from "./upload-request"

const PAGE_SIZE = 24

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
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedId,
  title = "Choose an image",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: MediaItem) => void
  selectedId?: string | null
  title?: string
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
  // Polite: start and finish only (the bar carries the percent).
  const [announcement, setAnnouncement] = useState("")
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
      setAnnouncement("")
    }
  }
  // The debounced search is tagged with its opening, so a term typed in an
  // earlier opening never leaks into this one. Clearing applies at once.
  const tag = `${session}:`
  const debounced = useDebouncedValue(tag + query.trim(), 250)
  const q =
    query.trim() && debounced.startsWith(tag) ? debounced.slice(tag.length) : ""

  const result = useQuery({
    queryKey: ["media", "list", { q, page }],
    queryFn: () =>
      unwrap(
        api.media.$get({
          query: {
            kind: "image",
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

  const uploadFile = async (file: File) => {
    setUpload({ name: file.name, progress: 0 })
    setAnnouncement(`Uploading ${file.name}…`)
    try {
      const item = await uploadMediaFile(file, {
        onProgress: (progress) => setUpload({ name: file.name, progress }),
      })
      await queryClient.invalidateQueries({ queryKey: ["media"] })
      // Newest first on page 1 with no search: the new image is in view.
      setQuery("")
      setPage(1)
      setChosen(item)
      setUpload(null)
      setAnnouncement(`${file.name} uploaded and selected.`)
    } catch (err) {
      setUpload({ name: file.name, error: errorMessage(err) })
      setAnnouncement("")
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
          <DialogDescription>
            Images in the media library. Upload a new one if it is not there
            yet.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search images"
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
          <div className="flex flex-wrap items-center gap-3">
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
              Upload new image
            </Button>
            <input
              ref={fileInput}
              type="file"
              hidden
              tabIndex={-1}
              accept={ACCEPTED_IMAGE_TYPES}
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
                className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground"
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
                className="min-w-0 flex-1 text-xs text-destructive"
              >
                <span className="sr-only">{upload.name}: </span>
                {upload.error}
              </p>
            ) : null}
            <p role="status" aria-label="Upload progress" className="sr-only">
              {announcement}
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
              {q
                ? `No images match “${q}”.`
                : "The media library has no images yet."}
            </div>
          ) : (
            <ul
              aria-label="Images"
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
                        <Image
                          src={item.url}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 170px, 45vw"
                          className="object-contain"
                        />
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
            Use this image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
