"use client"

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"
import { createContext, useContext } from "react"

import { useMediaItem } from "@/components/admin/media/use-media-item"
import { Input } from "@/components/ui/input"

/**
 * The editor field's `disabled` prop. Node views re-render on node changes
 * only, so they read it from context instead of `editor.isEditable`.
 */
export const RichTextDisabledContext = createContext(false)

/** Library image inside the editor: thumbnail + editable alt text. */
export function ImageNodeView({
  node,
  updateAttributes,
  selected,
}: ReactNodeViewProps) {
  const media = node.attrs.media as { mediaId: string } | null
  const item = useMediaItem(media?.mediaId)
  const disabled = useContext(RichTextDisabledContext)
  return (
    <NodeViewWrapper
      data-drag-handle
      className={`my-4 flex flex-col gap-2 rounded-lg border bg-muted/40 p-2 ${selected ? "ring-2 ring-ring" : ""}`}
    >
      {item.data ? (
        // eslint-disable-next-line @next/next/no-img-element -- editor preview of a library image
        <img
          src={item.data.url}
          alt=""
          className="max-h-64 w-full rounded-md object-contain"
        />
      ) : (
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
          {item.isError ? "Image not found in the library" : "Loading image…"}
        </div>
      )}
      <Input
        aria-label="Image description (alt text)"
        placeholder="Describe the image for screen readers"
        value={(node.attrs.alt as string) ?? ""}
        disabled={disabled}
        onChange={(event) => updateAttributes({ alt: event.target.value })}
      />
    </NodeViewWrapper>
  )
}
