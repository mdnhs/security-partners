"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
} from "react"

import {
  SECTION_TAB,
  SECTION_TAB_ACTIVE,
  SectionTabsColumn,
} from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import { activeChild, activeItem } from "@/lib/admin/nav"
import { cn } from "@/lib/utils"

const RailContext = createContext(false)

/** True for a page beside the section rail (its content sits on the panel). */
export function useInSectionRail(): boolean {
  return useContext(RailContext)
}

/**
 * From lg the rail stays put while main (the scroll container) scrolls:
 * sticky at main's padding, capped to the visible panel (--main-h less
 * main's padding top and bottom) and scrolling on its own when long.
 * -m-1/p-1 keep focus rings clear of that overflow clip.
 */
const COLUMN =
  "min-w-0 lg:sticky lg:top-0 lg:-m-1 lg:w-52 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:p-1 lg:max-h-[calc(var(--main-h,var(--content-h,100svh))-2*var(--main-pad,0px))]"

/**
 * The active section's sub-pages (Insights, Collections, SEO, Marketing,
 * Site settings) from the nav registry as a rail inside the content panel
 * (MK), so the sidebar lists sections only. Shown when the user may open
 * two or more of them; below lg a scrolling row above the page. The page
 * sits on the panel itself, not on a card.
 */
export function SectionRail({ children }: { children: ReactNode }) {
  const { roles } = useAdminSession()
  const pathname = usePathname()
  const item = activeItem(pathname, roles)
  const tabs = item?.children ?? []
  const current = item ? activeChild(item, pathname) : null
  const listRef = useRef<HTMLUListElement>(null)
  useCurrentInView(listRef, current?.id)
  if (!item || tabs.length < 2) return children
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <nav aria-label={item.label} className={COLUMN}>
        <p
          aria-hidden
          className="mb-2 hidden px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase lg:block"
        >
          {item.label}
        </p>
        <ul
          ref={listRef}
          // -m-1/p-1: the row's overflow clip keeps clear of focus rings.
          className="-m-1 flex [scrollbar-width:thin] gap-1 overflow-x-auto p-1 lg:mx-0 lg:my-0 lg:flex-col lg:overflow-visible lg:px-0 lg:py-0"
        >
          {tabs.map((tab) => {
            const active = tab.id === current?.id
            return (
              <li key={tab.id} className="flex shrink-0">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  data-current={active || undefined}
                  className={cn(
                    SECTION_TAB,
                    "min-h-11 lg:min-h-0 lg:w-full",
                    active && SECTION_TAB_ACTIVE
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-0 hidden h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary lg:block"
                    />
                  ) : null}
                  <span className="truncate">{tab.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div data-slot="section-content" className="min-w-0 flex-1">
        <RailContext.Provider value>
          <SectionTabsColumn>{children}</SectionTabsColumn>
        </RailContext.Provider>
      </div>
    </div>
  )
}

/**
 * Below lg the rail is a scrolling row: keep the current tab in view (a
 * deep link to the 6th settings page). Only the row scrolls.
 */
function useCurrentInView(
  list: RefObject<HTMLUListElement | null>,
  current: string | undefined
) {
  useEffect(() => {
    const row = list.current
    const active = row?.querySelector<HTMLElement>("[data-current]")
    if (!row || !active || row.scrollWidth <= row.clientWidth) return
    // The tab's place in the row's scrolled content, from the boxes (the
    // tab's offsetParent is not the row).
    const rowBox = row.getBoundingClientRect()
    const box = active.getBoundingClientRect()
    const left = box.left - rowBox.left + row.scrollLeft
    const right = left + box.width
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth)
      row.scrollTo({ left: left - 16 })
  }, [list, current])
}
