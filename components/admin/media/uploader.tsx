"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CircleAlert, CircleCheck, Upload } from "lucide-react"
import {
  type DragEvent,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/api-client"
import {
  ACCEPTED_UPLOAD_TYPES,
  MEDIA_ALT_MAX,
  type MediaItem,
} from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

import { uploadMediaFile } from "./upload-request"

export type UploadEntry = {
  id: number
  name: string
  progress: number
  /** "queued": waiting for a free slot (at most UPLOAD_CONCURRENCY at once). */
  status: "queued" | "uploading" | "done" | "error"
  error?: string
}

/** Files sent at the same time; the rest wait their turn. */
export const UPLOAD_CONCURRENCY = 3

const ACCEPTED = new Set(ACCEPTED_UPLOAD_TYPES.split(","))

/**
 * A polite live-region message. Each call clears the region first, so the
 * same text twice (two files with one name) is spoken twice.
 */
export function useAnnouncer() {
  const [message, setMessage] = useState("")
  const timer = useRef<number | undefined>(undefined)
  const announce = useCallback((next: string) => {
    window.clearTimeout(timer.current)
    setMessage("")
    if (next) timer.current = window.setTimeout(() => setMessage(next), 100)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return [message, announce] as const
}

/**
 * A queue of uploads, UPLOAD_CONCURRENCY XHRs at a time; refreshes every
 * media query after each success. Files of a type the library does not
 * take fail here without a request (an empty type is sent: the server
 * sniffs the bytes anyway). `announcement` is for a polite live region: it
 * changes when uploads start and finish, never with each percent
 * (failures speak through the entry's own alert).
 */
export function useMediaUploads(onUploaded?: (item: MediaItem) => void) {
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [announcement, announce] = useAnnouncer()
  const nextId = useRef(1)
  const queue = useRef<{ id: number; file: File; alt?: string }[]>([])
  const active = useRef(0)
  const latest = useRef(onUploaded)
  useEffect(() => {
    latest.current = onUploaded
  })
  const update = useCallback(
    (id: number, patch: Partial<UploadEntry>) =>
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      ),
    []
  )

  const pump = useCallback(
    function drain() {
      while (active.current < UPLOAD_CONCURRENCY && queue.current.length) {
        const { id, file, alt } = queue.current.shift()!
        active.current++
        update(id, { status: "uploading" })
        uploadMediaFile(file, {
          alt,
          onProgress: (p) => update(id, { progress: p }),
        })
          .then((item) => {
            update(id, { status: "done", progress: 1 })
            announce(`${file.name} uploaded.`)
            void queryClient.invalidateQueries({ queryKey: ["media"] })
            latest.current?.(item)
          })
          .catch((err: unknown) =>
            update(id, { status: "error", error: errorMessage(err) })
          )
          .finally(() => {
            active.current--
            drain()
          })
      }
    },
    [announce, queryClient, update]
  )

  /** `alt` applies when exactly one file is uploaded. */
  const start = useCallback(
    (files: File[], alt?: string) => {
      const added: UploadEntry[] = []
      const sendable: File[] = []
      for (const file of files) {
        const id = nextId.current++
        if (file.type && !ACCEPTED.has(file.type)) {
          added.push({
            id,
            name: file.name,
            progress: 0,
            status: "error",
            error:
              "This type of file is not supported. Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file, or a Lottie animation (.json or .lottie).",
          })
          continue
        }
        added.push({ id, name: file.name, progress: 0, status: "queued" })
        sendable.push(file)
        queue.current.push({
          id,
          file,
          alt: files.length === 1 && alt?.trim() ? alt.trim() : undefined,
        })
      }
      if (added.length === 0) return
      setEntries((prev) => [...prev, ...added])
      if (sendable.length)
        announce(
          sendable.length === 1
            ? `Uploading ${sendable[0]!.name}…`
            : `Uploading ${sendable.length} files…`
        )
      pump()
    },
    [announce, pump]
  )

  const clearFinished = () =>
    setEntries((prev) =>
      prev.filter((e) => e.status === "uploading" || e.status === "queued")
    )
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
  /** `alt`: the optional description typed above (used for one file). */
  onFiles: (files: File[], alt?: string) => void
  accept?: string
  disabled?: boolean
  label?: string
  multiple?: boolean
  /** The "Choose files" button, for callers that move focus back to it. */
  buttonRef?: Ref<HTMLButtonElement>
}) {
  const input = useRef<HTMLInputElement>(null)
  const altId = useId()
  const [alt, setAlt] = useState("")
  const [dragging, setDragging] = useState(false)
  const send = (files: File[]) => {
    if (files.length === 0) return
    onFiles(files, alt)
    // The description belonged to that one file.
    if (files.length === 1) setAlt("")
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = [...event.dataTransfer.files]
    send(multiple ? files : files.slice(0, 1))
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
        JPEG, PNG, WebP, AVIF, SVG or PDF, up to 20 MB each; Lottie animations
        (.json, .lottie) up to 2 MB.
      </p>
      <div className="flex w-full max-w-md flex-col gap-1.5 text-left">
        <label htmlFor={altId} className="text-sm font-medium text-foreground">
          Alternative text{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <p id={`${altId}-help`} className="text-xs">
          Describes the next image you upload for people who cannot see it. With
          several files, describe each one in its details.
        </p>
        <Input
          id={altId}
          value={alt}
          maxLength={MEDIA_ALT_MAX}
          disabled={disabled}
          aria-describedby={`${altId}-help`}
          className="h-10 rounded-xl bg-card pointer-coarse:h-11"
          onChange={(e) => setAlt(e.target.value)}
        />
      </div>
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
          send(files)
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
  const finished = entries.some(
    (e) => e.status === "done" || e.status === "error"
  )
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
                    : entry.status === "queued"
                      ? "Waiting"
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
