"use client"

import Image from "next/image"
import { type KeyboardEvent, type MouseEvent, useRef } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Point = { x: number; y: number }
const clamp = (v: number) => Math.min(1, Math.max(0, Math.round(v * 100) / 100))

/**
 * The point to keep in view when an image is cropped. Click the image or
 * use the arrow keys on the marker (Shift = larger steps); "Reset" = centre.
 */
export function FocalPointPicker({
  src,
  width,
  height,
  value,
  onChange,
  disabled,
}: {
  src: string
  /** Intrinsic size (raster uploads always have one). */
  width: number
  height: number
  value: Point | null
  onChange: (value: Point | null) => void
  disabled?: boolean
}) {
  const frame = useRef<HTMLDivElement>(null)
  const point = value ?? { x: 0.5, y: 0.5 }
  const pick = (event: MouseEvent) => {
    if (disabled || !frame.current) return
    const rect = frame.current.getBoundingClientRect()
    onChange({
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    })
  }
  const onKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02
    const moves: Record<string, Point> = {
      ArrowLeft: { x: point.x - step, y: point.y },
      ArrowRight: { x: point.x + step, y: point.y },
      ArrowUp: { x: point.x, y: point.y - step },
      ArrowDown: { x: point.x, y: point.y + step },
    }
    const next = moves[event.key]
    if (!next || disabled) return
    event.preventDefault()
    onChange({ x: clamp(next.x), y: clamp(next.y) })
  }
  const position = `${Math.round(point.x * 100)}% from the left, ${Math.round(point.y * 100)}% from the top`
  return (
    <div className="flex flex-col gap-2">
      {/* The click is a pointer shortcut; the marker below is the keyboard path. */}
      <div
        ref={frame}
        className="relative inline-block self-start rounded-xl border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[16px_16px]"
        onClick={pick}
      >
        <Image
          src={src}
          alt=""
          width={width}
          height={height}
          sizes="(min-width: 640px) 400px, 90vw"
          className={cn(
            "block h-auto max-h-56 w-auto max-w-full rounded-[11px]",
            !disabled && "cursor-crosshair"
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onKeyDown={onKey}
          onClick={(e) => e.stopPropagation()}
          aria-label={
            disabled
              ? `Focal point: ${position}.`
              : `Focal point: ${position}. Arrow keys move it.`
          }
          className="group/focal absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none pointer-coarse:size-11"
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        >
          <span
            aria-hidden
            className={cn(
              "size-5 rounded-full border-2 border-white bg-primary/70 shadow ring-1 ring-black/40 group-focus-visible/focal:ring-3 group-focus-visible/focal:ring-ring",
              !value && "border-dashed bg-transparent"
            )}
          />
        </button>
      </div>
      <div className="flex min-h-7 items-center gap-2 text-xs text-muted-foreground">
        <span>
          Focal point:{" "}
          {value
            ? `${Math.round(value.x * 100)}% × ${Math.round(value.y * 100)}%`
            : "centre (default)"}
        </span>
        {value && !disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="pointer-coarse:h-11 pointer-coarse:px-3"
            onClick={() => onChange(null)}
          >
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  )
}
