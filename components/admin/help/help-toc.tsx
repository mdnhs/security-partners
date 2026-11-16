"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import type { TocEntry } from "@/lib/admin/help/registry"
import { cn } from "@/lib/utils"

import { useReducedMotion } from "@/hooks/use-reduced-motion"

// How far below the top of the viewport a heading counts as "being read".
const READING_LINE = 140
// The gap left above a heading when a TOC link scrolls to it.
const SCROLL_OFFSET = 24

// The heading the reader is in: the last one that has passed the reading
// line, or the first while none has. At the very end of the page the last
// sections may never reach the line, so the last one wins there.
export function currentHeading(
  entries: readonly TocEntry[],
  topOf: (id: string) => number | undefined,
  atEnd = false
): string | undefined {
  if (atEnd) return entries.at(-1)?.id
  let current = entries[0]?.id
  for (const entry of entries) {
    const top = topOf(entry.id)
    if (top !== undefined && top <= READING_LINE) current = entry.id
  }
  return current
}

// ---------------------------------------------------------------------------
// The rail: one SVG path down the left of the list that steps in beside h3
// items and back out, built from each link's measured box.
// ---------------------------------------------------------------------------

// The rail's x for each level, and how far a bend reaches into the items on
// either side of it (so the jog is a visible diagonal, not a hairline).
export const RAIL_X = { 2: 1, 3: 13 } as const
const JOG = 9

export type RailItem = { top: number; height: number; level: 2 | 3 }
export type Rail = {
  d: string
  // Each item's straight run, as a distance along the path.
  segments: { start: number; length: number }[]
  total: number
  height: number
}

const round = (n: number) => Math.round(n * 2) / 2

export function buildRail(items: readonly RailItem[]): Rail {
  let d = ""
  let total = 0
  let last: { x: number; y: number } | undefined
  const segments: Rail["segments"] = []
  items.forEach((item, index) => {
    const x = RAIL_X[item.level]
    const prev = items[index - 1]
    const next = items[index + 1]
    const bendsIn = prev !== undefined && RAIL_X[prev.level] !== x
    const bendsOut = next !== undefined && RAIL_X[next.level] !== x
    const y1 = item.top + (bendsIn ? JOG : 0)
    const y2 = Math.max(y1, item.top + item.height - (bendsOut ? JOG : 0))
    if (last) {
      total += Math.hypot(x - last.x, y1 - last.y)
      d += ` L${round(x)} ${round(y1)}`
    } else {
      d += `M${round(x)} ${round(y1)}`
    }
    segments.push({ start: total, length: y2 - y1 })
    total += y2 - y1
    d += ` L${round(x)} ${round(y2)}`
    last = { x, y: y2 }
  })
  return { d, segments, total, height: last?.y ?? 0 }
}

// The accent dash that covers one item's run: a single dash as long as the
// run, then a gap longer than the whole path, shifted to where the run
// starts. Changing the offset slides the dash along the path, bends included.
export function highlightDash(rail: Rail, index: number) {
  const segment = rail.segments[index]
  if (!segment) return { dasharray: `0 ${rail.total + 1}`, dashoffset: 0 }
  return {
    dasharray: `${segment.length} ${rail.total + segment.length + 1}`,
    dashoffset: -segment.start,
  }
}

// The admin scrolls inside <main id="main">, not the window.
const scroller = () => document.getElementById("main")

function atEndOf(element: HTMLElement | null) {
  return (
    element !== null &&
    element.scrollHeight > element.clientHeight &&
    element.scrollTop + element.clientHeight >= element.scrollHeight - 4
  )
}

// Scroll a heading into view below the top edge, smoothly unless the viewer
// asked for less motion, and keep the address bar's #hash in step.
export function scrollToHeading(id: string, reduced: boolean) {
  const heading = document.getElementById(id)
  if (!heading) return false
  const behavior: ScrollBehavior = reduced ? "auto" : "smooth"
  const main = scroller()
  if (main) {
    const top =
      main.scrollTop +
      heading.getBoundingClientRect().top -
      main.getBoundingClientRect().top -
      SCROLL_OFFSET
    main.scrollTo?.({ top, behavior })
  } else {
    heading.scrollIntoView?.({ behavior, block: "start" })
  }
  history.replaceState(null, "", `#${id}`)
  return true
}

// "On this page" in the right column: the rail with its bends, an accent
// segment that slides to the section being read, and scroll-spy.
export function HelpToc({ entries }: { entries: readonly TocEntry[] }) {
  const [active, setActive] = useState<string | undefined>(entries[0]?.id)
  const [rail, setRail] = useState<Rail>(() => buildRail([]))
  const reduced = useReducedMotion()
  const listRef = useRef<HTMLUListElement>(null)
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([])
  // A clicked item's smooth scroll passes other headings; hold the choice.
  const heldUntil = useRef(0)

  // Measure every link and rebuild the path whenever the list resizes.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () =>
      setRail(
        buildRail(
          entries.map((entry, index) => ({
            top: linkRefs.current[index]?.offsetTop ?? 0,
            height: linkRefs.current[index]?.offsetHeight ?? 0,
            level: entry.level,
          }))
        )
      )
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [entries])

  const update = useCallback(() => {
    if (Date.now() < heldUntil.current) return
    setActive(
      currentHeading(
        entries,
        (id) => document.getElementById(id)?.getBoundingClientRect().top,
        atEndOf(scroller())
      )
    )
  }, [entries])

  // Scroll-spy: a heading crossing the top part of the viewport moves the
  // highlight. The end of the page is its own case (short last sections
  // never reach the reading line), checked on scroll.
  useEffect(() => {
    update()
    const cleanups: (() => void)[] = []
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(() => update(), {
        rootMargin: "0px 0px -60% 0px",
        threshold: [0, 1],
      })
      for (const entry of entries) {
        const heading = document.getElementById(entry.id)
        if (heading) observer.observe(heading)
      }
      cleanups.push(() => observer.disconnect())
    }
    const onScroll = () => {
      if (atEndOf(scroller())) update()
    }
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    })
    cleanups.push(() =>
      window.removeEventListener("scroll", onScroll, { capture: true })
    )
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [entries, update])

  if (entries.length === 0) return null
  const dash = highlightDash(
    rail,
    entries.findIndex((entry) => entry.id === active)
  )
  return (
    <nav aria-label="On this page" className="flex flex-col gap-3 text-sm">
      <p className="text-[13px] font-semibold text-foreground">On this page</p>
      <ul ref={listRef} className="relative flex flex-col">
        <svg
          aria-hidden
          data-testid="toc-rail"
          className="pointer-events-none absolute top-0 left-0 overflow-visible"
          width={RAIL_X[3] + 2}
          height={Math.max(rail.height, 1)}
          fill="none"
        >
          <path
            d={rail.d}
            className="stroke-border"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <path
            d={rail.d}
            data-testid="toc-active"
            data-reduced-motion={reduced ? "" : undefined}
            className="stroke-primary"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: dash.dasharray,
              strokeDashoffset: dash.dashoffset,
              transition: reduced
                ? "none"
                : "stroke-dashoffset 300ms ease, stroke-dasharray 300ms ease",
            }}
          />
        </svg>
        {entries.map((entry, index) => {
          const current = entry.id === active
          return (
            <li key={entry.id}>
              <a
                ref={(element) => {
                  linkRefs.current[index] = element
                }}
                href={`#${entry.id}`}
                data-level={entry.level}
                aria-current={current ? "location" : undefined}
                onClick={(event) => {
                  if (!scrollToHeading(entry.id, reduced)) return
                  event.preventDefault()
                  heldUntil.current = Date.now() + (reduced ? 0 : 800)
                  setActive(entry.id)
                }}
                className={cn(
                  "block py-1.5 leading-5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none",
                  entry.level === 3 ? "pl-8" : "pl-4",
                  current && "text-foreground"
                )}
              >
                {entry.title}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Below xl the right column is gone: the same list folds into a disclosure
// at the top of the article.
export function HelpTocDisclosure({
  entries,
}: {
  entries: readonly TocEntry[]
}) {
  const reduced = useReducedMotion()
  if (entries.length === 0) return null
  return (
    <details className="group rounded-xl border border-border bg-card text-sm xl:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        On this page
        <span
          aria-hidden
          className="text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
        >
          ▾
        </span>
      </summary>
      <ul className="flex flex-col gap-1 border-t border-border px-4 py-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              onClick={(event) => {
                if (scrollToHeading(entry.id, reduced)) event.preventDefault()
              }}
              className={cn(
                "block py-1 text-muted-foreground hover:text-foreground",
                entry.level === 3 && "pl-4"
              )}
            >
              {entry.title}
            </a>
          </li>
        ))}
      </ul>
    </details>
  )
}
