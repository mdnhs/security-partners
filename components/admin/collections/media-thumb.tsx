"use client"

import { ImageIcon } from "lucide-react"

import { useMediaItem } from "@/components/admin/media/use-media-item"

/** Small library thumbnail for list cells and cards. */
export function MediaThumb({
  mediaId,
  size = 40,
}: {
  mediaId: string | null | undefined
  size?: number
}) {
  const item = useMediaItem(mediaId)
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40"
    >
      {item.data ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
        <img
          src={item.data.url}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <ImageIcon aria-hidden className="size-4 text-muted-foreground" />
      )}
    </span>
  )
}
