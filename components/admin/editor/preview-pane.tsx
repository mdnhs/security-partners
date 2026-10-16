"use client"

import { ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export const PREVIEW_DEVICES = {
  desktop: 1440,
  tablet: 834,
  phone: 390,
} as const
type Device = keyof typeof PREVIEW_DEVICES

/** How long a load may take before the pane offers a new tab instead. */
const LOAD_TIMEOUT_MS = 10_000

/**
 * The public site in draft mode, scaled to the pane (JW page builder).
 * `refreshKey` is the saved draft version: each autosave sends the frame
 * back to the record's preview URL (not merely a reload, so a link clicked
 * inside the frame — "Exit preview", the nav — never leaves the pane
 * showing something else). Only mount it where it is wanted: the preview
 * route turns draft mode on for the user.
 */
export function PreviewPane({
  src,
  refreshKey,
  className,
}: {
  src: string
  refreshKey: number
  className?: string
}) {
  const [device, setDevice] = useState<Device>("desktop")
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const shownKey = useRef(refreshKey)
  const width = PREVIEW_DEVICES[device]
  const scale = box.width ? Math.min(1, box.width / width) : 1

  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setBox({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (shownKey.current === refreshKey) return
    shownKey.current = refreshKey
    const el = frame.current
    if (!el) return
    setLoading(true)
    setFailed(false)
    // Reassigning src (even the same value) navigates the frame afresh.
    el.src = src
  }, [refreshKey, src])

  // A frame that never fires load (blocked, offline, a hung route) would
  // spin forever: after a while say so and point at the new tab.
  useEffect(() => {
    if (!loading) return
    const timer = window.setTimeout(() => {
      setLoading(false)
      setFailed(true)
    }, LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [loading])

  const onLoad = () => {
    setLoading(false)
    setFailed(false)
  }

  return (
    <section
      aria-label="Live preview"
      className={cn(
        "rounded-card flex min-w-0 flex-col gap-4 border bg-card p-4 shadow-xs sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-card-title flex items-center gap-2">
          Preview
          {loading ? (
            <Spinner aria-label="Refreshing" className="size-4 text-primary" />
          ) : null}
        </h2>
        <div className="flex items-center gap-2">
          <ToggleGroup
            value={[device]}
            onValueChange={(value) => {
              if (value[0]) setDevice(value[0] as Device)
            }}
            aria-label="Preview size"
            variant="outline"
            size="lg"
            className="[&_[data-slot=toggle-group-item]]:pointer-coarse:h-11 [&_[data-slot=toggle-group-item]]:pointer-coarse:min-w-11"
          >
            <ToggleGroupItem value="desktop" aria-label="Desktop">
              <Monitor aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="tablet" aria-label="Tablet">
              <Tablet aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="phone" aria-label="Phone">
              <Smartphone aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            aria-label="Open the preview in a new tab"
            className="flex size-9 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11"
          >
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>
      </div>
      {/* As tall as the visible panel allows beside the sticky bar (the
          rail uses the same budget), never shorter than 28 rem. */}
      <div
        ref={boxRef}
        className="relative h-[calc(var(--main-h,80svh)-2*var(--main-pad,0px)-var(--section-tabs-top,0px)-6.5rem)] min-h-112 overflow-hidden rounded-xl bg-muted"
      >
        {failed ? (
          <p
            role="status"
            aria-label="Preview didn't load"
            className="absolute inset-x-4 top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-xs"
          >
            <span>
              <span className="font-semibold">Preview didn&apos;t load.</span>{" "}
              <span className="text-muted-foreground">
                It will try again after the next save.
              </span>
            </span>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Open it in a new tab
            </a>
          </p>
        ) : null}
        <iframe
          ref={frame}
          title="Page preview"
          src={src}
          referrerPolicy="same-origin"
          onLoad={onLoad}
          className={cn(
            "absolute top-0 border-0 bg-white transition-opacity",
            box.width === 0 && "opacity-0",
            scale === 1 && device !== "desktop" && "shadow-lg"
          )}
          style={{
            width,
            height: box.height ? box.height / scale : "100%",
            left: Math.max(0, (box.width - width * scale) / 2),
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </section>
  )
}
