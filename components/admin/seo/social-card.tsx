"use client"

import { useId } from "react"

/**
 * How a share looks on social networks (MK style): the 1.91:1 image, then
 * the host, title and description under it.
 */
export function SocialCard({
  host,
  title,
  description,
  imageUrl,
}: {
  host: string
  title: string
  description: string
  imageUrl: string
}) {
  const captionId = useId()
  return (
    <figure
      aria-labelledby={captionId}
      data-slot="social-card"
      className="flex flex-col gap-2"
    >
      <figcaption
        id={captionId}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Social card preview
      </figcaption>
      <div className="overflow-hidden rounded-xl border bg-background">
        <div className="aspect-[1.91/1] w-full bg-muted">
          {/* Admin preview of an arbitrary media/OG URL: next/image would
              need every size configured; decorative (the text says it). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex flex-col gap-0.5 border-t px-3 py-2.5">
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
