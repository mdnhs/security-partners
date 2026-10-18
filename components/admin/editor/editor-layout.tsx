"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import {
  type ContentState,
  ContentStatusPills,
  type StatusPillSpec,
  StatusPills,
} from "@/components/admin/kit/content-status"
import { useListHref } from "@/components/admin/data-table/list-url"
import { useInSectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { cn } from "@/lib/utils"

/** Header buttons (History, Preview, Publish, Delete): 40 px, 44 on touch. */
export const EDITOR_ACTION =
  "h-10 gap-2 rounded-xl px-3 font-semibold sm:px-4 pointer-coarse:h-11"

/** Space kept between the stuck bar and what sits below it. */
const GAP = 16

/**
 * Sticky offsets, all from main's padding (--main-pad, set by the shell):
 * - The bar sticks 12 px below main's top edge (below lg) or at main's
 *   padding (from lg, level with the Settings rail), so `top` is that
 *   distance less the padding (sticky offsets count from the padding edge).
 * - A strip in main's grey (::before, drawn in admin.css) fills the space
 *   above the stuck bar (--strip-h: 12 px / --main-pad) and the corners
 *   beside its rounded top, so fields never show through there. That space
 *   is at rest main's padding or the gap above the Settings card: the strip
 *   never covers the tab row.
 */
const STICKY =
  "@container/bar sticky z-20 top-[calc(0.75rem-var(--main-pad,0px))] lg:top-0 [--strip-h:0.75rem] lg:[--strip-h:var(--main-pad)]"

/**
 * Editor frame (JW page builder): a sticky header card (back link where a
 * parent list exists, title, public path, status pills, save state,
 * actions), then the form. Inside section tabs (Settings) the header is
 * the opaque, full-width top of the tab's white card (padding --card-pad);
 * elsewhere it is a card of its own. Sets --section-tabs-top so the form's
 * sticky tab rail stops below the bar, and keeps a focused field from
 * hiding under it (WCAG 2.4.11).
 */
export function EditorLayout({
  backHref,
  backLabel,
  title,
  status,
  path,
  saveState,
  actions,
  aside,
  asideColumnFrom = "2xl",
  longTitle = false,
  preview,
  children,
}: {
  /** Omit when the editor sits in route tabs (the rail is the way back). */
  backHref?: string
  backLabel?: string
  title: string
  /** The record's state (Draft / Published / Unpublished changes), or pills of its own. */
  status: ContentState | readonly StatusPillSpec[]
  /** Public path of the record ("/services/cctv"), shown beside the pills. */
  path?: string
  saveState: ReactNode
  actions: ReactNode
  aside?: ReactNode
  /**
   * Width from which the side panel becomes a column beside the form
   * (above the form before that). "xl" for a panel the work needs at hand
   * (an article's settings); without the live preview only.
   */
  asideColumnFrom?: "xl" | "2xl"
  /**
   * Titles are usually long (articles): the title side keeps at least
   * 24rem, so a long action row drops below it instead of truncating it.
   */
  longTitle?: boolean
  /** Live preview pane (Task 8): a sticky column beside the form from 2xl. */
  preview?: ReactNode
  children: ReactNode
}) {
  const inTabs = useInSectionTabs()
  // Back to the list as it was left (page, sort, search, filters).
  const backTo = useListHref(backHref ?? "")
  const barRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const barHeight = useHeight(barRef)
  useKeepFocusBelow(barRef, contentRef)
  useScrollPaddingBelow(barRef, barHeight)
  return (
    <div
      className="flex flex-col gap-6"
      style={{ "--section-tabs-top": `${barHeight + GAP}px` } as CSSProperties}
    >
      <header
        ref={barRef}
        data-slot="editor-bar"
        className={cn(
          STICKY,
          "bg-card",
          inTabs
            ? // The card's top: full width over its padding, a rule below.
              "rounded-t-card -mx-(--card-pad,0px) -mt-(--card-pad,0px) border-b px-(--card-pad) py-4"
            : // A card of its own; the strip starts outside its 1 px border.
              "rounded-card border px-4 py-4 shadow-xs [--bar-border:1px] sm:px-6"
        )}
      >
        {/* Side by side once the bar is wide enough (container query): the
            title side can shrink (its pills wrap under the title), and the
            actions only drop below it when they still do not fit. */}
        <div className="flex flex-col gap-4 @2xl/bar:flex-row @2xl/bar:flex-wrap @2xl/bar:items-center @2xl/bar:justify-between">
          <div
            className={cn(
              "flex min-w-0 flex-col gap-1.5",
              longTitle
                ? "@2xl/bar:flex-[1_1_24rem]"
                : "@2xl/bar:flex-[1_1_14rem]"
            )}
          >
            {backHref ? (
              <Link
                href={backTo}
                className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ArrowLeft aria-hidden className="size-4" />
                {backLabel}
              </Link>
            ) : null}
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="xl:text-title line-clamp-3 min-w-0 text-2xl font-bold tracking-tight [overflow-wrap:anywhere]">
                {title}
              </h1>
              {path ? (
                <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                  {path}
                </code>
              ) : null}
              {isPillList(status) ? (
                <StatusPills pills={status} />
              ) : (
                <ContentStatusPills record={status} />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saveState}
            {actions}
          </div>
        </div>
      </header>
      {/* The form has its own section tabs: the side panel joins it as a
          column only from 2xl and sits above it before that. With the live
          preview (2xl only) the preview takes that column, sticky under the
          bar, and the side panel stays above the form. */}
      {preview ? (
        <div
          ref={contentRef}
          className="grid w-full gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
        >
          <div data-slot="editor-form" className="flex min-w-0 flex-col gap-6">
            {aside ? (
              <aside className="flex flex-col gap-4">{aside}</aside>
            ) : null}
            {children}
          </div>
          <div className="min-w-0 2xl:sticky 2xl:top-(--section-tabs-top) 2xl:self-start">
            {preview}
          </div>
        </div>
      ) : (
        <div
          ref={contentRef}
          className={cn(
            "grid w-full gap-6",
            asideColumnFrom === "xl"
              ? "xl:grid-cols-[minmax(0,1fr)_18rem]"
              : "2xl:grid-cols-[minmax(0,1fr)_18rem]",
            inTabs ? "max-w-240" : "max-w-304"
          )}
        >
          <div data-slot="editor-form" className="min-w-0">
            {children}
          </div>
          {aside ? (
            <aside
              className={cn(
                "order-first flex flex-col gap-4",
                asideColumnFrom === "xl" ? "xl:order-0" : "2xl:order-0"
              )}
            >
              {aside}
            </aside>
          ) : null}
        </div>
      )}
    </div>
  )
}

const isPillList = (
  status: ContentState | readonly StatusPillSpec[]
): status is readonly StatusPillSpec[] => Array.isArray(status)

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

/**
 * The content panel (main) scrolls behind the stuck bar: its scroll
 * padding follows the bar's height, so anything scrolled into view by the
 * browser (an anchor, scrollIntoView) lands below the bar (WCAG 2.4.11).
 */
function useScrollPaddingBelow(
  barRef: RefObject<HTMLElement | null>,
  barHeight: number
) {
  useEffect(() => {
    const scroller = barRef.current?.closest("main")
    if (!scroller || barHeight === 0) return
    scroller.style.scrollPaddingTop = `${barHeight + GAP}px`
    return () => {
      scroller.style.removeProperty("scroll-padding-top")
    }
  }, [barRef, barHeight])
}

/**
 * WCAG 2.2 SC 2.4.11: a control that receives focus (Tab, Shift+Tab, an
 * error jump) is scrolled clear of the sticky bar. The browser only scrolls
 * a focused element that is outside the panel, and one under the bar is
 * inside it; so the panel scrolls up by the overlap plus a gap.
 */
function useKeepFocusBelow(
  barRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    function onFocusIn(event: FocusEvent) {
      const bar = barRef.current
      const scroller = bar?.closest("main")
      if (!bar || !scroller || !(event.target instanceof HTMLElement)) return
      const barRect = bar.getBoundingClientRect()
      if (barRect.height === 0) return
      const top = event.target.getBoundingClientRect().top
      if (top < barRect.bottom + GAP / 2)
        scroller.scrollTop += top - barRect.bottom - GAP
    }
    content.addEventListener("focusin", onFocusIn)
    return () => content.removeEventListener("focusin", onFocusIn)
  }, [barRef, contentRef])
}
