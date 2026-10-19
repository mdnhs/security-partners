"use client"

import { ImageOff } from "lucide-react"
import { useId, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * How a share looks on social networks (MK style): the 1.91:1 image, then
 * the host, title and description under it. `size="small"` is X's summary
 * card: a square thumbnail beside the text. An image that is empty (still
 * loading) or fails to load (e.g. the generated card of an unpublished
 * record) leaves a labelled empty frame.
 */
export function SocialCard({
  host,
  title,
  description,
  imageUrl,
  size = "large",
}: {
  host: string
  title: string
  description: string
  imageUrl: string
  size?: "large" | "small"
}) {
  const captionId = useId()
  // The URL that failed (a new URL gets its own try).
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = imageUrl !== "" && failed !== imageUrl
  const small = size === "small"
  return (
    <figure
      aria-labelledby={captionId}
      data-slot="social-card"
      data-size={size}
      className="flex flex-col gap-2"
    >
      <figcaption
        id={captionId}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Social card preview
      </figcaption>
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-background",
          small && "flex items-stretch"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center bg-muted",
            small ? "aspect-square w-24 shrink-0" : "aspect-[1.91/1] w-full"
          )}
        >
          {showImage ? (
            // Admin preview of an arbitrary media/OG URL: next/image would
            // need every size configured; decorative (the text says it).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
              onError={() => setFailed(imageUrl)}
            />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <ImageOff aria-hidden className="size-5" />
              No preview
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-col gap-0.5 px-3 py-2.5",
            small ? "justify-center border-l" : "border-t"
          )}
        >
          <span className="truncate text-xs text-muted-foreground uppercase">
            {host.replace(/^www\./, "")}
          </span>
          <span className="line-clamp-2 text-sm font-semibold">{title}</span>
          {description ? (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {description}
            </span>
          ) : null}
        </div>
      </div>
    </figure>
  )
}
