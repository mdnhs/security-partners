"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ImageOff, Search } from "lucide-react"
import { useState } from "react"

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
import type { MediaItem } from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 24

/**
 * Pick an existing image from the media library. Phase 4 lists the seeded
 * library read-only; Phase 6 adds uploading from this dialog.
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
  // Each opening starts fresh: no stale search, page or choice.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery("")
      setPage(1)
      setChosen(null)
    }
  }
  const debounced = useDebouncedValue(query.trim(), 250)
  // Clearing the search (or reopening) shows everything at once.
  const q = query.trim() ? debounced : ""

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
            Images already in the media library.
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
                      <span className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[16px_16px]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails of arbitrary sizes */}
                        <img
                          src={item.url}
                          alt=""
                          loading="lazy"
                          className="max-h-full max-w-full object-contain"
                        />
                      </span>
                      <span className="line-clamp-2 min-h-8 text-xs">
                        {item.alt || item.url.split("/").pop()}
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
