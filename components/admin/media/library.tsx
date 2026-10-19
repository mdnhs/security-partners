"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { FileText, ImageOff, LayoutGrid, List, Search } from "lucide-react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { DataTablePagination } from "@/components/admin/data-table/data-table-pagination"
import {
  LIST_PAGE,
  LIST_QUERY,
  mergeListSearch,
  replaceListSearch,
} from "@/components/admin/data-table/list-url"
import { UnsavedGuard } from "@/components/admin/editor/unsaved-guard"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { NowProvider, RelativeTime } from "@/components/admin/kit/relative-time"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { isMediaId } from "@/lib/media"
import type { MediaItem, MediaKind } from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

import { formatBytes, mediaName, typeLabel } from "./format"
import { MediaDetails } from "./media-details"
import {
  MediaDropzone,
  UploadAnnouncer,
  UploadList,
  useMediaUploads,
} from "./uploader"

const PAGE_SIZE = 24
const KINDS: { value: MediaKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "document", label: "Documents" },
]

/** Toolbar toggles: 36 px, 44 px on touch screens (WCAG 2.5.8). */
const TOGGLE =
  "h-9 bg-card px-3 pointer-coarse:h-11 aria-pressed:bg-muted aria-pressed:font-semibold aria-pressed:text-foreground"
const ICON_TOGGLE =
  "size-9 bg-card pointer-coarse:size-11 aria-pressed:bg-muted aria-pressed:text-foreground"
const CHECKER =
  "bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[16px_16px]"

/** Library thumbnail: next/image from the same-origin URL (SVG unoptimised). */
function Thumb({
  item,
  className,
  sizes,
}: {
  item: MediaItem
  className?: string
  sizes: string
}) {
  return (
    <span
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-lg",
        CHECKER,
        className
      )}
    >
      {item.mime.startsWith("image/") ? (
        <Image
          src={item.url}
          alt=""
          fill
          sizes={sizes}
          className="object-contain"
        />
      ) : (
        <FileText aria-hidden className="size-8 text-muted-foreground" />
      )}
    </span>
  )
}

/** `?open=` accepts only a UUID; anything else is ignored and dropped from the URL. */
const openParam = (value: string | null): string | null =>
  isMediaId(value) ? value : null

/**
 * Media library (spec §8.1): grid/list, search, kind and missing-alt filters,
 * drag & drop upload, details sheet (`?open=<id>` opens one file's).
 */
export function MediaLibrary() {
  const canUpload = usePermission({ media: ["create"] })
  // Search, filters, view, page and the open file start from the URL and are written back
  // (final review I8), so a reload or Back returns to the same spot.
  const searchParams = useSearchParams()
  const [initial] = useState(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    const kindParam = params.get("kind") ?? ""
    const pageParam = Number(params.get(LIST_PAGE))
    return {
      q: params.get(LIST_QUERY) ?? "",
      kind: (KINDS as readonly { value: string }[]).some(
        (k) => k.value === kindParam
      )
        ? (kindParam as MediaKind | "all")
        : "all",
      view:
        params.get("view") === "list" ? ("list" as const) : ("grid" as const),
      page: Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1,
      missingAlt: params.get("missingAlt") === "true",
      // Only a file id: the value goes into the API path (review I1).
      open: openParam(params.get("open")),
    }
  })
  const [query, setQuery] = useState(initial.q)
  const [kind, setKind] = useState<MediaKind | "all">(initial.kind)
  const [view, setView] = useState<"grid" | "list">(initial.view)
  const [page, setPage] = useState(initial.page)
  const [missingAlt, setMissingAlt] = useState(initial.missingAlt)
  const [selected, setSelected] = useState<string | null>(initial.open)
  const search = useRef<HTMLInputElement>(null)
  const choose = useRef<HTMLButtonElement>(null)
  const debounced = useDebouncedValue(query.trim(), 250)
  // Clearing the search applies at once; typing waits for a pause.
  const q = query.trim() ? debounced : ""
  useEffect(() => {
    replaceListSearch(
      mergeListSearch(
        window.location.search,
        {
          [LIST_QUERY]: q,
          kind: kind === "all" ? undefined : kind,
          missingAlt: missingAlt ? "true" : undefined,
          view: view === "grid" ? undefined : view,
          [LIST_PAGE]: page > 1 ? String(page) : undefined,
          open: selected ?? undefined,
        },
        { keepPage: true }
      )
    )
  }, [q, kind, missingAlt, view, page, selected])
  // Back to page 1 when the applied search changes (adjusted during render).
  const [pagedQ, setPagedQ] = useState(q)
  if (pagedQ !== q) {
    setPagedQ(q)
    setPage(1)
  }

  const list = useQuery({
    queryKey: [
      "media",
      "list",
      { q, page, kind, missingAlt, pageSize: PAGE_SIZE },
    ],
    queryFn: () =>
      unwrap(
        api.media.$get({
          query: {
            q: q || undefined,
            kind: kind === "all" ? undefined : kind,
            missingAlt: missingAlt ? "true" : undefined,
            page: String(page),
            pageSize: String(PAGE_SIZE),
          },
        })
      ),
    placeholderData: keepPreviousData,
  })
  // A finished upload opens its details, unless another file is open (no
  // switching under someone who is typing alt text).
  const onUploaded = useCallback(
    (item: MediaItem) => setSelected((open) => open ?? item.id),
    []
  )
  const uploads = useMediaUploads(onUploaded)
  const items = list.data?.items ?? []
  // A page past the end (its last files deleted): go to the last page.
  const lastPage = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))
  if (list.data && !list.isPlaceholderData && page > lastPage) setPage(lastPage)
  const filtered = kind !== "all" || missingAlt

  return (
    <div className="flex flex-col gap-5">
      {canUpload ? (
        <div className="flex flex-col gap-3">
          <MediaDropzone onFiles={uploads.start} buttonRef={choose} />
          <UploadList
            entries={uploads.entries}
            onClear={() => {
              uploads.clearFinished()
              choose.current?.focus()
            }}
          />
          <UploadAnnouncer message={uploads.announcement} />
          {/* Leaving mid-upload aborts it: ask first (final review M12). */}
          <UnsavedGuard
            when={uploads.entries.some(
              (e) => e.status === "uploading" || e.status === "queued"
            )}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={search}
            type="search"
            aria-label="Search media"
            placeholder="Search by description or file name"
            className="h-10 rounded-xl bg-card pl-9 pointer-coarse:h-11"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ButtonGroup aria-label="Kind">
          {KINDS.map((k) => (
            <Button
              key={k.value}
              type="button"
              variant="outline"
              className={TOGGLE}
              aria-pressed={kind === k.value}
              onClick={() => {
                setKind(k.value)
                setPage(1)
              }}
            >
              {k.label}
            </Button>
          ))}
        </ButtonGroup>
        <Button
          type="button"
          variant="outline"
          className={cn(TOGGLE, "rounded-full")}
          aria-pressed={missingAlt}
          onClick={() => {
            setMissingAlt((on) => !on)
            setPage(1)
          }}
        >
          Missing alt text
        </Button>
        <ButtonGroup aria-label="View" className="sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            className={ICON_TOGGLE}
            aria-pressed={view === "grid"}
            aria-label="Grid"
            onClick={() => setView("grid")}
          >
            <LayoutGrid aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            className={ICON_TOGGLE}
            aria-pressed={view === "list"}
            aria-label="List"
            onClick={() => setView("list")}
          >
            <List aria-hidden />
          </Button>
        </ButtonGroup>
      </div>

      {list.isError ? (
        <EmptyState
          role="alert"
          title="The media library didn't load"
          description={errorMessage(list.error)}
          action={
            <Button
              type="button"
              className={FORM_ACTION}
              onClick={() => list.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : list.isPending ? (
        <div role="status">
          <span className="sr-only">Loading media…</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          role={q || filtered ? "status" : undefined}
          title={q || filtered ? "No matches" : "No files yet"}
          description={
            q
              ? `Nothing matches “${q}”.`
              : filtered
                ? missingAlt
                  ? kind === "document"
                    ? "Documents don't need alt text. Turn off Missing alt text to see them."
                    : "Every image has alt text or is marked decorative."
                  : kind === "image"
                    ? "There are no images in the library."
                    : "There are no documents in the library."
                : canUpload
                  ? "Upload images and PDFs above; pages, services and articles can then use them."
                  : "Images and PDFs appear here once someone uploads them."
          }
        />
      ) : (
        <NowProvider now={list.dataUpdatedAt}>
          <div
            className={cn(
              "transition-opacity",
              list.isPlaceholderData && "opacity-60"
            )}
          >
            {/* The next page is loading: announced, not aria-busy (DataTable). */}
            <p role="status" className="sr-only">
              {list.isPlaceholderData ? "Loading media…" : null}
            </p>
            {view === "grid" ? (
              <ul
                aria-label="Files"
                className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"
              >
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(item.id)}
                      className="rounded-card flex w-full flex-col gap-2 border border-transparent bg-card p-2 text-left outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Thumb
                        item={item}
                        className="aspect-square w-full"
                        sizes="(min-width: 1024px) 180px, (min-width: 640px) 25vw, 50vw"
                      />
                      <span className="line-clamp-2 min-h-10 px-1 text-sm font-medium wrap-anywhere">
                        {mediaName(item)}
                      </span>
                      <span className="px-1 text-xs text-muted-foreground">
                        {typeLabel(item.mime)} · {formatBytes(item.size)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-card overflow-x-auto bg-card">
                <Table>
                  <TableCaption className="sr-only">Files</TableCaption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead
                        scope="col"
                        className="w-16 text-muted-foreground"
                      >
                        <span className="sr-only">Preview</span>
                      </TableHead>
                      <TableHead scope="col" className="text-muted-foreground">
                        Name
                      </TableHead>
                      <TableHead scope="col" className="text-muted-foreground">
                        Type
                      </TableHead>
                      <TableHead scope="col" className="text-muted-foreground">
                        Size
                      </TableHead>
                      <TableHead
                        scope="col"
                        className="hidden text-muted-foreground sm:table-cell"
                      >
                        Dimensions
                      </TableHead>
                      <TableHead
                        scope="col"
                        className="hidden text-muted-foreground sm:table-cell"
                      >
                        Added
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/40">
                        <TableCell className="py-2">
                          <Thumb item={item} className="size-10" sizes="40px" />
                        </TableCell>
                        <TableCell className="py-2 whitespace-normal">
                          <button
                            type="button"
                            onClick={() => setSelected(item.id)}
                            className="min-h-6 rounded-sm text-left font-medium wrap-anywhere text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
                          >
                            {mediaName(item)}
                          </button>
                        </TableCell>
                        <TableCell className="py-2 whitespace-normal text-muted-foreground">
                          {typeLabel(item.mime)}
                        </TableCell>
                        <TableCell className="py-2 text-muted-foreground tabular-nums">
                          {formatBytes(item.size)}
                        </TableCell>
                        <TableCell className="hidden py-2 text-muted-foreground tabular-nums sm:table-cell">
                          {item.width && item.height
                            ? `${item.width} × ${item.height}`
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden py-2 whitespace-normal text-muted-foreground sm:table-cell">
                          <RelativeTime iso={item.createdAt} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </NowProvider>
      )}

      {list.isPending || list.isError ? null : (
        <DataTablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={list.data.total}
          disabled={list.isPlaceholderData}
          onPageChange={setPage}
        />
      )}

      <MediaDetails
        id={selected}
        onClose={() => setSelected(null)}
        afterDelete={search}
      />
    </div>
  )
}
