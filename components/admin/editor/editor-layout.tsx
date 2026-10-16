"use client"

import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { useInSectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { Badge } from "@/components/ui/badge"

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
 * Inside section tabs (Settings) the bar is the opaque top of the tab
 * content card (sticking on its own, beside the sticky rail), and
 * without `backHref` (a tab rail is the way back) there is no back link.
 * Sets --section-tabs-top so the form's sticky tab rail stops below the bar.
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
  /** Omit when the editor sits in route tabs (the rail is the way back). */
  backHref?: string
  backLabel?: string
  title: string
  status: { text: string; variant: "default" | "secondary" | "outline" }
  saveState: ReactNode
  actions: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  const inTabs = useInSectionTabs()
  const barRef = useRef<HTMLDivElement>(null)
  const barHeight = useHeight(barRef)
  const bar = (
    <>
      {backHref ? (
        <Link
          href={backHref}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {backLabel}
        </Link>
      ) : null}
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
    </>
  )
  return (
    <div
      className="flex flex-col gap-6"
      // Bar height + the gap-6 below it.
      style={{ "--section-tabs-top": `${barHeight + 24}px` } as CSSProperties}
    >
      {inTabs ? (
        // Sticky at the top of the section-tabs content card (p-4 sm:p-6):
        // a strip in main's grey fills main's top padding (sticky elements
        // stop inside it, so fields would show above the bar), and the bar
        // is the card's opaque, full-width top with its rounded corners.
        <div
          data-slot="editor-bar-sticky"
          className="sticky -top-4 z-20 -mx-4 -mt-8 bg-sidebar pt-4 sm:-top-6 sm:-mx-6 sm:-mt-12 sm:pt-6 lg:-top-8 lg:-mt-14 lg:pt-8"
        >
          <div
            ref={barRef}
            data-slot="editor-bar"
            className="rounded-t-card flex flex-col gap-3 border-b bg-card px-4 py-3 sm:px-6 sm:py-4"
          >
            {bar}
          </div>
        </div>
      ) : (
        // Flush with main's top edge (negative top = main's padding), opaque
        // in main's grey so nothing shows through.
        <div
          ref={barRef}
          data-slot="editor-bar"
          className="sticky -top-4 z-20 -mx-4 -mt-6 flex flex-col gap-3 border-b bg-sidebar px-4 py-3 sm:-top-6 sm:-mx-6 sm:px-6 lg:-top-8 lg:-mx-8 lg:-mt-8 lg:px-8"
        >
          {bar}
        </div>
      )}
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

/** An element's border-box height, kept current as it wraps or resizes. */
function useHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setHeight(element.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return height
}
