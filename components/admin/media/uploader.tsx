"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CircleAlert, CircleCheck, Upload } from "lucide-react"
import { type DragEvent, type Ref, useCallback, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api-client"
import { ACCEPTED_UPLOAD_TYPES, type MediaItem } from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

import { uploadMediaFile } from "./upload-request"

export type UploadEntry = {
  id: number
  name: string
  progress: number
  status: "uploading" | "done" | "error"
  error?: string
}

/**
 * One XHR per file; refreshes every media query after each success.
 * `announcement` is for a polite live region: it changes when uploads
 * start and finish, never with each percent (failures speak through the
 * entry's own alert).
 */
export function useMediaUploads(onUploaded?: (item: MediaItem) => void) {
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [announcement, setAnnouncement] = useState("")
  const nextId = useRef(1)
  const update = (id: number, patch: Partial<UploadEntry>) =>
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    )

  const start = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      setAnnouncement(
        files.length === 1
          ? `Uploading ${files[0]!.name}…`
          : `Uploading ${files.length} files…`
      )
      for (const file of files) {
        const id = nextId.current++
        setEntries((prev) => [
          ...prev,
          { id, name: file.name, progress: 0, status: "uploading" },
        ])
        uploadMediaFile(file, {
          onProgress: (p) => update(id, { progress: p }),
        })
          .then((item) => {
            update(id, { status: "done", progress: 1 })
            setAnnouncement(`${file.name} uploaded.`)
            void queryClient.invalidateQueries({ queryKey: ["media"] })
            onUploaded?.(item)
          })
          .catch((err: unknown) =>
            update(id, { status: "error", error: errorMessage(err) })
          )
      }
    },
    [queryClient, onUploaded]
  )

  const clearFinished = () =>
    setEntries((prev) => prev.filter((e) => e.status === "uploading"))
  return { entries, start, clearFinished, announcement }
}

/**
 * Drop zone with a "Choose files" button (the keyboard and touch path);
 * the hidden input is marked data-upload-input.
 */
export function MediaDropzone({
  onFiles,
  accept = ACCEPTED_UPLOAD_TYPES,
  disabled,
  label = "Drop files here to upload",
  multiple = true,
  buttonRef,
}: {
  onFiles: (files: File[]) => void
  accept?: string
  disabled?: boolean
  label?: string
  multiple?: boolean
  /** The "Choose files" button, for callers that move focus back to it. */
  buttonRef?: Ref<HTMLButtonElement>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = [...event.dataTransfer.files]
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }
  return (
    <section
      aria-label="Upload files"
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(e) => {
        // Leaving for a child (the button) is not leaving the zone.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDragging(false)
      }}
      onDrop={onDrop}
      data-dragging={dragging || undefined}
      className={cn(
        "rounded-card flex flex-col items-center gap-3 border-2 border-dashed bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground transition-colors",
        dragging && "border-primary bg-primary/5 text-foreground"
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
        <Upload aria-hidden className="size-5" />
      </span>
      <p className="font-medium text-foreground">{label}</p>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        className="h-10 rounded-xl bg-card px-4 font-semibold pointer-coarse:h-11"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        Choose files
      </Button>
      <p className="text-xs">
        JPEG, PNG, WebP, AVIF, SVG or PDF, up to 20 MB each.
      </p>
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        data-upload-input
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ""
          if (files.length) onFiles(files)
        }}
      />
    </section>
  )
}

/** Always rendered (sr-only): a live region must exist before it speaks. */
export function UploadAnnouncer({ message }: { message: string }) {
  return (
    <p role="status" aria-label="Upload progress" className="sr-only">
      {message}
    </p>
  )
}

/** One row per upload: a progress bar while sending, then the result. */
export function UploadList({
  entries,
  onClear,
}: {
  entries: UploadEntry[]
  onClear: () => void
}) {
  if (entries.length === 0) return null
  const finished = entries.some((e) => e.status !== "uploading")
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Uploads" className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={cn(
              "flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-sm",
              entry.status === "error" && "border-destructive/40"
            )}
          >
            <span className="flex items-center gap-2">
              {entry.status === "done" ? (
                <CircleCheck
                  aria-hidden
                  className="text-success size-4 shrink-0"
                />
              ) : entry.status === "error" ? (
                <CircleAlert
                  aria-hidden
                  className="size-4 shrink-0 text-destructive"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate font-medium">
                {entry.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {entry.status === "done"
                  ? "Uploaded"
                  : entry.status === "error"
                    ? "Failed"
                    : `${Math.round(entry.progress * 100)}%`}
              </span>
            </span>
            {entry.status === "uploading" ? (
              <div
                role="progressbar"
                aria-label={`Uploading ${entry.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(entry.progress * 100)}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full bg-primary transition-[width] motion-reduce:transition-none"
                  style={{ width: `${entry.progress * 100}%` }}
                />
              </div>
            ) : null}
            {entry.error ? (
              <p role="alert" className="text-xs text-destructive">
                <span className="sr-only">{entry.name}: </span>
                {entry.error}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {finished ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start pointer-coarse:h-11"
          onClick={onClear}
        >
          Clear finished
        </Button>
      ) : null}
    </div>
  )
}
