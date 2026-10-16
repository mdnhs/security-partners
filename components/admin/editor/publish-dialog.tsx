"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  type EditorMeta,
  humanize,
  metaFor,
} from "@/components/admin/schema-form/editor-meta"
import { diffValues } from "@/lib/json"

/** "hero.stats.1.label" → "Hero › Stats › 2 › Label" using editor labels. */
export function pathLabel(meta: EditorMeta, path: string): string {
  if (!path) return "Everything"
  const parts = path.split(".")
  return parts
    .map((part, i) => {
      if (/^\d+$/.test(part)) return String(Number(part) + 1)
      const prefix = parts.slice(0, i + 1).join(".")
      return metaFor(meta, prefix).label ?? humanize(part)
    })
    .join(" › ")
}

/** Short readable form of a changed value. */
export function previewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)"
  if (typeof value === "string")
    return value.length > 140 ? `${value.slice(0, 140)}…` : value
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (typeof value === "object" && value && "mediaId" in value)
    return "Image changed"
  if (
    typeof value === "object" &&
    value &&
    (value as { type?: string }).type === "doc"
  )
    return "Formatted text changed"
  if (Array.isArray(value)) return `${value.length} items`
  return "Changed"
}

/** Confirms a publish and lists what the site will change (draft vs published). */
export function PublishDialog({
  open,
  onOpenChange,
  meta,
  published,
  draft,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: EditorMeta
  published: unknown
  draft: unknown
  pending: boolean
  onConfirm: () => void
}) {
  const changes = published === null ? [] : diffValues(published, draft)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publish changes?</DialogTitle>
          <DialogDescription>
            {published === null
              ? "This is the first publish: everything becomes visible on the site."
              : changes.length === 0
                ? "Nothing changed since the last publish. Publishing again is harmless."
                : `${changes.length} ${changes.length === 1 ? "change goes" : "changes go"} live on the site right away.`}
          </DialogDescription>
        </DialogHeader>
        {changes.length > 0 ? (
          <ul
            aria-label="Changes"
            className="max-h-80 divide-y overflow-y-auto rounded-lg border text-sm"
          >
            {changes.map((change) => (
              <li key={change.path} className="flex flex-col gap-1 p-3">
                <span className="font-medium">
                  {pathLabel(meta, change.path)}
                </span>
                <span className="text-muted-foreground line-through decoration-muted-foreground/60">
                  {previewValue(change.before)}
                </span>
                <span>{previewValue(change.after)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {pending ? <Spinner /> : null}
            Publish now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
