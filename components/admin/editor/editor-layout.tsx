"use client"

import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { useInSectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Status badge text for a versioned record. */
export function statusLabel(record: { published: unknown; dirty: boolean }): {
  text: string
  variant: "default" | "secondary" | "outline"
} {
  if (record.published === null)
    return { text: "Not published", variant: "outline" }
  if (record.dirty) return { text: "Unpublished changes", variant: "secondary" }
  return { text: "Published", variant: "default" }
}

/**
 * Editor frame: back link, title + status, save state and actions in a
 * sticky bar under the topbar; the form below in a readable column.
 * Inside section tabs (Settings) the bar spans the tab content only.
 */
export function EditorLayout({
  backHref,
  backLabel,
  title,
  status,
  saveState,
  actions,
  aside,
  children,
}: {
  backHref: string
  backLabel: string
  title: string
  status: { text: string; variant: "default" | "secondary" | "outline" }
  saveState: ReactNode
  actions: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  const inTabs = useInSectionTabs()
  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          "sticky top-0 z-20 flex flex-col gap-3 border-b bg-background/95 py-3 backdrop-blur supports-backdrop-filter:bg-background/80",
          !inTabs &&
            "-mx-4 -mt-6 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8"
        )}
      >
        <Link
          href={backHref}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {title}
            </h1>
            <Badge variant={status.variant}>{status.text}</Badge>
            {saveState}
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
      {/* The form has its own section tabs: the side panel joins it as a
          column only from 2xl and sits above it before that. */}
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">{children}</div>
        {aside ? (
          <aside className="order-first flex flex-col gap-4 2xl:order-none">
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  )
}
