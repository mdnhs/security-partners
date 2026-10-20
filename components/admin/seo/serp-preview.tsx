"use client"

import { useId } from "react"

const clip = (text: string, max: number) => {
  const chars = [...text]
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`
    : text
}

/** "example.ie › services › alarm-responses" (Google's breadcrumb URL). */
export function serpBreadcrumb(host: string, path: string): string {
  const segments = path
    .split(/[?#]/)[0]
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
  return [host, ...segments].join(" › ")
}

/**
 * How the page may look as a Google result (MK style): site name line with
 * the breadcrumb URL, the blue title (~60 chars) and the snippet (~160).
 */
export function SerpPreview({
  host,
  path,
  title,
  description,
}: {
  host: string
  path: string
  title: string
  description: string
}) {
  const crumb = serpBreadcrumb(host, path)
  const captionId = useId()
  return (
    <figure
      aria-labelledby={captionId}
      className="flex flex-col gap-2 rounded-xl border bg-background p-4"
    >
      <figcaption
        id={captionId}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Search result preview
      </figcaption>
      <div className="flex min-w-0 items-center gap-2.5 font-[arial,sans-serif]">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground uppercase"
        >
          {host.replace(/^www\./, "").charAt(0)}
        </span>
        <span className="min-w-0 truncate text-xs text-[#4d5156] dark:text-[#bdc1c6]">
          {crumb}
        </span>
      </div>
      <p className="font-[arial,sans-serif] text-xl leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
        {clip(title, 60)}
      </p>
      <p className="line-clamp-2 font-[arial,sans-serif] text-sm leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">
        {description ? (
          clip(description, 160)
        ) : (
          <span className="italic">The site-wide default description</span>
        )}
      </p>
    </figure>
  )
}
