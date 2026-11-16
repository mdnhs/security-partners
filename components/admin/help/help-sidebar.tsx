"use client"

import { ChevronRight, Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useId, useMemo, useState, useSyncExternalStore } from "react"

import { useReducedMotion } from "@/hooks/use-reduced-motion"
import {
  HELP_HREF,
  type HelpGroupId,
  helpHref,
  normaliseSearch,
} from "@/lib/admin/help/registry"
import { cn } from "@/lib/utils"

import { HELP_GROUP_ICONS } from "./help-icons"

export type HelpNavGroup = {
  id: HelpGroupId
  label: string
  articles: { slug: string; title: string }[]
}

export const OPEN_GROUPS_KEY = "admin-help-open-groups"

/** The stored value as a string, so the snapshot stays stable between reads. */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(OPEN_GROUPS_KEY)
  } catch {
    return null
  }
}

function parseStored(raw: string | null): HelpGroupId[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((id): id is HelpGroupId => typeof id === "string")
      : []
  } catch {
    return []
  }
}

/**
 * Storage is only read, never watched: this tab's own writes go through
 * state, and another tab's choice can wait for the next page.
 */
const noSubscribe = () => () => {}

function writeStored(open: readonly HelpGroupId[]) {
  try {
    window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(open))
  } catch {
    // Private windows and blocked storage: the sidebar just forgets.
  }
}

/**
 * The groups whose articles match a filter (on the title), each with only
 * its matching articles. An empty filter keeps everything.
 */
export function filterGroups(
  groups: readonly HelpNavGroup[],
  filter: string
): HelpNavGroup[] {
  const needle = normaliseSearch(filter)
  if (!needle) return [...groups]
  return groups
    .map((group) => ({
      ...group,
      articles: group.articles.filter((article) =>
        normaliseSearch(article.title).includes(needle)
      ),
    }))
    .filter((group) => group.articles.length > 0)
}

/** The article slug a help path is on; null on the overview. */
export function activeHelpSlug(pathname: string | null): string | null {
  const rest = (pathname ?? "").slice(HELP_HREF.length).replace(/^\/+/, "")
  return rest.split(/[/?#]/)[0] || null
}

/**
 * The docs' left column: a filter, then one collapsible group per area.
 * Several groups may be open at once; the current article's group opens on
 * its own, and the open groups are remembered in this browser. It lives in
 * help/layout.tsx, so it stays mounted (open groups, filter text, scroll)
 * while the article beside it changes. The current article comes from the
 * URL unless a test passes it in.
 */
export function HelpSidebar({
  groups,
  active: activeProp,
  onNavigate,
}: {
  groups: readonly HelpNavGroup[]
  /** The current article's slug; null on the overview. Read from the URL when left out. */
  active?: string | null
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active =
    activeProp === undefined ? activeHelpSlug(pathname) : activeProp
  const reduced = useReducedMotion()
  const baseId = useId()
  const current = groups.find((group) =>
    group.articles.some((article) => article.slug === active)
  )?.id
  // The groups this browser had open (none on the server, so the first
  // render matches; the client fills them in on hydration).
  const raw = useSyncExternalStore(noSubscribe, readRaw, () => null)
  const stored = useMemo(() => parseStored(raw), [raw])
  // The viewer's own choice once they toggle; until then, what was stored
  // plus the current article's group.
  const [choice, setChoice] = useState<HelpGroupId[] | null>(null)
  const [filter, setFilter] = useState("")
  const open = choice ?? [
    ...new Set([...stored, ...(current ? [current] : [])]),
  ]

  // Moving to an article in another group opens that group too (the
  // sidebar keeps its state across client-side navigation).
  const [openedFor, setOpenedFor] = useState(current)
  if (current !== openedFor) {
    setOpenedFor(current)
    if (choice && current && !choice.includes(current))
      setChoice([...choice, current])
  }

  function toggle(id: HelpGroupId) {
    const next = open.includes(id)
      ? open.filter((other) => other !== id)
      : [...open, id]
    writeStored(next)
    setChoice(next)
  }

  const filtering = normaliseSearch(filter) !== ""
  const shown = filterGroups(groups, filter)

  return (
    <nav aria-label="Help topics" className="flex flex-col gap-4 text-sm">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter topics"
          aria-label="Filter help topics"
          className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11"
        />
      </div>
      <Link
        href={HELP_HREF}
        onClick={onNavigate}
        aria-current={active === null ? "page" : undefined}
        className={cn(
          "border-l-2 px-3 py-1.5 font-semibold transition-colors hover:text-foreground",
          active === null
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground"
        )}
      >
        Overview
      </Link>
      {shown.length === 0 ? (
        <p className="px-3 text-muted-foreground">No topics match.</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {shown.map((group) => {
          const Icon = HELP_GROUP_ICONS[group.id]
          // A filter opens every group it matches, without touching the
          // remembered choice.
          const expanded = filtering || open.includes(group.id)
          const panelId = `${baseId}-${group.id}`
          return (
            <li key={group.id}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(group.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1">{group.label}</span>
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground",
                    !reduced && "transition-transform duration-200",
                    expanded && "rotate-90"
                  )}
                />
              </button>
              <div
                id={panelId}
                data-testid={`help-group-${group.id}`}
                data-state={expanded ? "open" : "closed"}
                inert={!expanded}
                className={cn(
                  "grid",
                  !reduced &&
                    "transition-[grid-template-rows] duration-200 ease-out",
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <ul className="flex min-h-0 flex-col overflow-hidden pl-5">
                  {group.articles.map((article) => {
                    const isCurrent = article.slug === active
                    return (
                      <li key={article.slug}>
                        <Link
                          href={helpHref(article.slug)}
                          onClick={onNavigate}
                          aria-current={isCurrent ? "page" : undefined}
                          className={cn(
                            "my-0.5 block border-l-2 py-1.5 pr-2 pl-3 leading-5 transition-colors hover:text-foreground",
                            isCurrent
                              ? "border-primary font-medium text-foreground"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {article.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
