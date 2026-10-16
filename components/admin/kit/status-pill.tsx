import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-accent text-accent-foreground",
  neutral: "bg-muted text-muted-foreground",
}

const STATUS_TONES: Record<string, StatusTone> = {
  published: "success",
  live: "success",
  active: "success",
  won: "success",
  "signed in": "success",
  draft: "neutral",
  closed: "neutral",
  hidden: "neutral",
  "in review": "info",
  scheduled: "info",
  new: "info",
  invited: "info",
  "unpublished changes": "warning",
  contacted: "warning",
  qualified: "warning",
  failed: "danger",
  banned: "danger",
  spam: "danger",
  lost: "danger",
}

export const toneForStatus = (status: string): StatusTone =>
  STATUS_TONES[status.trim().toLowerCase()] ?? "neutral"

/** Soft fill, strong text: Published / Draft / Unpublished changes / New … */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      data-slot="status-pill"
      data-tone={tone}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold whitespace-nowrap",
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
