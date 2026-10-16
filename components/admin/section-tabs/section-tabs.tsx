"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react"

import { cn } from "@/lib/utils"

export type SectionTabItem = {
  id: string
  label: string
  /** Route mode: every item links to its own page (/admin/settings/<key>). */
  href?: string
  badge?: ReactNode
  error?: boolean
  icon?: LucideIcon
}

/** `replace`: a keyboard or programmatic change (no new history entry). */
export type TabChangeOptions = { replace?: boolean }

export type SectionTabsProps = {
  items: SectionTabItem[]
  /** Selected tab (in-page) or current route (route mode); defaults to ?tab= / the path. */
  value?: string
  /** Called with `{ replace: true }` for keyboard moves, without options for clicks. */
  onValueChange?: (id: string, options?: TabChangeOptions) => void
  /** In-page mode: <SectionTabsPanel>s. Route mode: the page. */
  children: ReactNode
  ariaLabel: string
  /** Search param holding the selected in-page tab. */
  param?: string
  /** Small uppercase caption above the vertical list (JW section label); decorative. */
  heading?: string
}

// How deep we are in SectionTabs: a nested set (an editor's groups inside
// the Settings tabs) only becomes a column from xl, so two columns of tabs
// never squeeze the content at lg.
const DepthContext = createContext(0)

/** True inside another SectionTabs' content (layouts drop full-bleed tricks). */
export function useInSectionTabs(): boolean {
  return useContext(DepthContext) > 0
}

type PanelContextValue = {
  selected: string
  tabId: (id: string) => string
  panelId: (id: string) => string
}
const PanelContext = createContext<PanelContextValue | null>(null)

// ?tab= as an external store: pushState (which Next.js integrates into its
// router) does not fire popstate, so selecting a tab announces itself.
const URL_EVENT = "section-tabs:url"
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener(URL_EVENT, callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener(URL_EVENT, callback)
  }
}

/**
 * [current ?param value, select] — a click pushes a history entry (Back
 * returns); keyboard and programmatic changes pass `{ replace: true }` so
 * arrowing through tabs or an error jump does not flood the history.
 */
export function useTabParam(
  param = "tab"
): [string | undefined, (id: string, options?: TabChangeOptions) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(param) ?? undefined,
    () => undefined
  )
  const select = useCallback(
    (id: string, options?: TabChangeOptions) => {
      const url = new URL(window.location.href)
      if (url.searchParams.get(param) === id) return
      url.searchParams.set(param, id)
      if (options?.replace) window.history.replaceState(null, "", url)
      else window.history.pushState(null, "", url)
      window.dispatchEvent(new Event(URL_EVENT))
    },
    [param]
  )
  return [value, select]
}

/**
 * Below the breakpoint the tabs are a scrolling row: keep the current one in
 * view (e.g. a deep link to the 6th settings key). Only the row scrolls.
 */
function useCurrentInView(
  list: RefObject<HTMLElement | null>,
  current: string | undefined
) {
  useEffect(() => {
    const row = list.current
    const active = row?.querySelector<HTMLElement>("[data-current]")
    if (!row || !active || row.scrollWidth <= row.clientWidth) return
    const left = active.offsetLeft
    const right = left + active.offsetWidth
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth)
      row.scrollTo({ left: left - 16 })
  }, [list, current])
}

/**
 * From the breakpoint the rail stays put while the page scrolls (main is
 * the scroll container): sticky at --section-tabs-top, which an editor
 * sets below its own sticky header (0 elsewhere), capped to the visible
 * panel and scrolling on its own when the list is long. -m-1/p-1 keep the
 * focus ring clear of the rail's overflow clip. Below it the tabs are a
 * plain row (a sticky row would collide with the editor's sticky header).
 */
const LAYOUT = {
  lg: {
    root: "flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8",
    column:
      "lg:w-52 lg:shrink-0 lg:sticky lg:top-[var(--section-tabs-top,0px)] lg:-m-1 lg:max-h-[calc(var(--content-h,100svh)-var(--section-tabs-top,0px))] lg:self-start lg:overflow-y-auto lg:p-1",
    list: "lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0",
    tab: "lg:w-full",
    marker: "lg:block",
    /** px where the list becomes a column (Tailwind lg / xl). */
    columnFrom: 1024,
    /** The selected content on a white card beside the grey rail. */
    content: "min-w-0 flex-1 rounded-card bg-card p-4 sm:p-6",
  },
  xl: {
    root: "flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-8",
    column:
      "xl:w-52 xl:shrink-0 xl:sticky xl:top-[var(--section-tabs-top,0px)] xl:-m-1 xl:max-h-[calc(var(--content-h,100svh)-var(--section-tabs-top,0px))] xl:self-start xl:overflow-y-auto xl:p-1",
    list: "xl:flex-col xl:overflow-visible xl:px-0 xl:pb-0",
    tab: "xl:w-full",
    marker: "xl:block",
    columnFrom: 1280,
    // Nested sets already sit on their parent's card.
    content: "min-w-0 flex-1",
  },
} as const

const TAB =
  "relative flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
const TAB_ACTIVE = "bg-sidebar-accent font-semibold text-foreground"

/**
 * aria-orientation follows the layout: a row below the breakpoint, a column
 * from it (server and first hydration render assume the desktop column).
 */
function useIsColumn(minWidth: number): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(`(min-width: ${minWidth}px)`)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [minWidth]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth >= minWidth,
    () => true
  )
}

function Caption({ text, marker }: { text?: string; marker: string }) {
  if (!text) return null
  return (
    <p
      aria-hidden
      className={cn(
        "mb-2 hidden px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase",
        marker
      )}
    >
      {text}
    </p>
  )
}

function TabContent({
  item,
  active,
  marker,
}: {
  item: SectionTabItem
  active: boolean
  marker: string
}) {
  const Icon = item.icon
  return (
    <>
      {active ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-0 hidden h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary",
            marker
          )}
        />
      ) : null}
      {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
      <span className="truncate">{item.label}</span>
      {item.badge || item.error ? (
        <span className="ml-auto flex items-center gap-1.5 pl-1">
          {item.badge}
          {item.error ? (
            <>
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-destructive"
              />
              <span className="sr-only">, has errors</span>
            </>
          ) : null}
        </span>
      ) : null}
    </>
  )
}

/**
 * A page's sections as vertical tabs on the left (a scrolling row below
 * lg). Items with `href` are route tabs (a nav, aria-current); otherwise an
 * ARIA tablist whose <SectionTabsPanel>s all stay mounted (form state is
 * kept) and whose selection lives in ?tab= so links and Back work.
 */
export function SectionTabs(props: SectionTabsProps) {
  const depth = useContext(DepthContext)
  const layout = depth > 0 ? LAYOUT.xl : LAYOUT.lg
  const routeMode =
    props.items.length > 0 && props.items.every((item) => item.href)
  return (
    <DepthContext.Provider value={depth + 1}>
      {routeMode ? (
        <RouteTabs {...props} layout={layout} />
      ) : (
        <InPageTabs {...props} layout={layout} />
      )}
    </DepthContext.Provider>
  )
}

type Layout = (typeof LAYOUT)[keyof typeof LAYOUT]
const LIST = "-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"

function RouteTabs({
  items,
  value,
  children,
  ariaLabel,
  heading,
  layout,
}: SectionTabsProps & { layout: Layout }) {
  const pathname = usePathname()
  // The deepest item whose href covers the path.
  const current =
    value ??
    items
      .filter(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
      )
      .sort((a, b) => b.href!.length - a.href!.length)[0]?.id
  const listRef = useRef<HTMLUListElement>(null)
  useCurrentInView(listRef, current)
  return (
    <div className={layout.root}>
      <nav aria-label={ariaLabel} className={cn("min-w-0", layout.column)}>
        <Caption text={heading} marker={layout.marker} />
        <ul ref={listRef} className={cn(LIST, layout.list)}>
          {items.map((item) => {
            const active = item.id === current
            return (
              <li key={item.id} className="flex shrink-0">
                <Link
                  href={item.href!}
                  aria-current={active ? "page" : undefined}
                  data-current={active || undefined}
                  data-error={item.error || undefined}
                  className={cn(TAB, layout.tab, active && TAB_ACTIVE)}
                >
                  <TabContent
                    item={item}
                    active={active}
                    marker={layout.marker}
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div data-slot="section-tabs-content" className={layout.content}>
        {children}
      </div>
    </div>
  )
}

function InPageTabs({
  items,
  value,
  onValueChange,
  children,
  ariaLabel,
  param = "tab",
  heading,
  layout,
}: SectionTabsProps & { layout: Layout }) {
  const [fromUrl, selectInUrl] = useTabParam(param)
  const known = (id: string | undefined) =>
    id !== undefined && items.some((item) => item.id === id)
  const selected =
    value !== undefined
      ? value
      : known(fromUrl)
        ? fromUrl!
        : (items[0]?.id ?? "")
  const base = useId()
  const tabId = useCallback((id: string) => `${base}-tab-${id}`, [base])
  const panelId = useCallback((id: string) => `${base}-panel-${id}`, [base])
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const listRef = useRef<HTMLDivElement>(null)
  useCurrentInView(listRef, selected)
  const isColumn = useIsColumn(layout.columnFrom)

  const select = (id: string, options?: TabChangeOptions) => {
    if (id === selected) return
    if (options) onValueChange?.(id, options)
    else onValueChange?.(id)
    if (value === undefined) selectInUrl(id, options)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === selected)
    const last = items.length - 1
    const next = {
      ArrowDown: index >= last ? 0 : index + 1,
      ArrowRight: index >= last ? 0 : index + 1,
      ArrowUp: index <= 0 ? last : index - 1,
      ArrowLeft: index <= 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    const item = items[next]
    refs.current.get(item.id)?.focus()
    select(item.id, { replace: true })
  }

  return (
    <div className={layout.root}>
      <div className={cn("min-w-0", layout.column)}>
        <Caption text={heading} marker={layout.marker} />
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          aria-orientation={isColumn ? "vertical" : "horizontal"}
          onKeyDown={onKeyDown}
          className={cn(LIST, layout.list)}
        >
          {items.map((item) => {
            const active = item.id === selected
            return (
              <button
                key={item.id}
                ref={(node) => {
                  if (node) refs.current.set(item.id, node)
                  else refs.current.delete(item.id)
                }}
                type="button"
                role="tab"
                id={tabId(item.id)}
                aria-selected={active}
                data-current={active || undefined}
                aria-controls={panelId(item.id)}
                tabIndex={active ? 0 : -1}
                data-error={item.error || undefined}
                onClick={() => select(item.id)}
                className={cn(TAB, layout.tab, active && TAB_ACTIVE)}
              >
                <TabContent
                  item={item}
                  active={active}
                  marker={layout.marker}
                />
              </button>
            )
          })}
        </div>
      </div>
      <div data-slot="section-tabs-content" className={layout.content}>
        <PanelContext.Provider value={{ selected, tabId, panelId }}>
          {children}
        </PanelContext.Provider>
      </div>
    </div>
  )
}

/** One in-page tab's content; hidden (not unmounted) while another tab is selected. */
export function SectionTabsPanel({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  const context = useContext(PanelContext)
  if (!context)
    throw new Error("SectionTabsPanel must render inside in-page SectionTabs")
  const active = context.selected === id
  return (
    <div
      role="tabpanel"
      id={context.panelId(id)}
      aria-labelledby={context.tabId(id)}
      hidden={!active}
    >
      {children}
    </div>
  )
}
