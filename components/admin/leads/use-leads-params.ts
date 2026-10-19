"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import {
  LIST_PAGE,
  LIST_QUERY,
  mergeListSearch,
  ownHistoryState,
  replaceListSearch,
} from "@/components/admin/data-table/list-url"
import {
  isUnsavedGuardEntry,
  useUnsavedRegistry,
} from "@/components/admin/editor/unsaved-guard"
import { isLeadId, parseLeadFilters } from "@/lib/admin/leads"
import type { LeadStatus } from "@/lib/schemas/api/leads"

export type LeadsFolder = "inbox" | "spam"
export type LeadsView = "board" | "table"

export type LeadsParams = {
  folder: LeadsFolder
  view: LeadsView
  lead: string | null
  status?: LeadStatus | "open" | "all"
  q?: string
  page: number
  /**
   * Assignee filter ("me", "none" or a user id; absent = anyone). Beyond
   * the D3.2 interface: the inbox already had it, and one hook owns the URL.
   */
  assignee?: string
}

/** History-state key on the entry pushed when a lead's drawer opens. */
const DRAWER_KEY = "spLeadDrawer"
/**
 * History-state key naming the document that wrote an entry. After a reload
 * the old entries name another document: stepping back onto them would be a
 * full page load, so a drawer then closes by replacing its entry.
 */
const DOC_KEY = "spLeadsDoc"
const DOC =
  typeof window === "undefined"
    ? ""
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
/** The unsaved-changes scope of a lead drawer's note. */
export const leadGuardScope = (id: string) => `lead:${id}`

/**
 * At most this many entries are stepped over when a drawer closes.
 *
 * Known limits (D3.3 re-review N1/N2, accepted):
 * - A reload on a note's guard entry (the browser's own prompt already
 *   asked), then close: the entry is replaced, and Back later reaches the
 *   old document's `?lead=` entry, a full load that opens the drawer.
 * - More than this many stacked drawer/guard entries (repeated Forward →
 *   edit → re-arm) end in a replace, leaving lower `?lead=` entries that
 *   reopen on Back. The bound keeps the close from looping.
 */
const MAX_CLOSE_STEPS = 4

const historyState = (): Record<string, unknown> =>
  (window.history.state as Record<string, unknown> | null) ?? {}

/**
 * Is the current entry one this document wrote for lead `id`'s drawer: the
 * entry its opening pushed, or an unsaved-changes guard entry above an
 * entry of this document? Stepping back off it stays on this page.
 */
function isDrawerEntry(id: string): boolean {
  const state = historyState()
  return (
    state[DOC_KEY] === DOC &&
    (state[DRAWER_KEY] === id || isUnsavedGuardEntry(state))
  )
}

/**
 * Stamps a new current entry as this document's. An entry that already
 * names a document keeps it (after a reload it names the old one).
 */
function stampEntry() {
  if (DOC_KEY in historyState()) return
  window.history.replaceState(
    { ...ownHistoryState(), [DOC_KEY]: DOC },
    "",
    window.location.href
  )
}

/** localStorage key of the last chosen view (this browser only). */
export const LEADS_VIEW_KEY = "sp-leads-view"
/** The board is the inbox's default view, as in MK (D3.3). */
const DEFAULT_VIEW: LeadsView = "board"

const isView = (value: string | null): value is LeadsView =>
  value === "board" || value === "table"

function readStoredView(): LeadsView | null {
  try {
    const value = window.localStorage.getItem(LEADS_VIEW_KEY)
    return isView(value) ? value : null
  } catch {
    // Storage blocked (private mode, policy): the default view.
    return null
  }
}

const viewListeners = new Set<() => void>()
function subscribeView(onChange: () => void) {
  viewListeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    viewListeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

function storeView(view: LeadsView) {
  try {
    window.localStorage.setItem(LEADS_VIEW_KEY, view)
  } catch {
    // Not remembered; the URL still carries it.
  }
  for (const listener of viewListeners) listener()
}

/**
 * The leads screen's state from its query string. `?status=spam` (older
 * links) is the Spam folder; the Spam folder is always a table. `?lead=` is
 * kept only when it is a UUID.
 */
export function parseLeadsParams(
  search: string,
  storedView: LeadsView | null = null
): LeadsParams {
  const params = new URLSearchParams(search)
  const filters = parseLeadFilters(params)
  const folder: LeadsFolder =
    params.get("folder") === "spam" || filters.status === "spam"
      ? "spam"
      : "inbox"
  const urlView = params.get("view")
  const lead = params.get("lead")
  const page = Number(params.get(LIST_PAGE))
  return {
    folder,
    view:
      folder === "spam"
        ? "table"
        : isView(urlView)
          ? urlView
          : (storedView ?? DEFAULT_VIEW),
    lead: isLeadId(lead) ? lead.toLowerCase() : null,
    status: folder === "spam" ? "spam" : filters.status || undefined,
    q: params.get(LIST_QUERY) || undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
    assignee: filters.assignee || undefined,
  }
}

/** The query-string changes for `patch` ("" / undefined removes a key). */
function searchPatch(
  patch: Partial<LeadsParams>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  if ("folder" in patch) {
    out.folder = patch.folder === "spam" ? "spam" : undefined
    // A folder starts with no status filter of its own.
    out.status = undefined
  }
  if ("status" in patch) {
    if (patch.status === "spam") {
      out.folder = "spam"
      out.status = undefined
    } else out.status = patch.status || undefined
  }
  if ("assignee" in patch) out.assignee = patch.assignee || undefined
  if ("view" in patch && patch.view) out.view = patch.view
  if ("q" in patch) out[LIST_QUERY] = patch.q || undefined
  if ("page" in patch)
    out[LIST_PAGE] =
      patch.page && patch.page > 1 ? String(patch.page) : undefined
  if ("lead" in patch)
    out.lead = isLeadId(patch.lead) ? patch.lead.toLowerCase() : undefined
  return out
}

/**
 * URL-synced leads state (D3.2). Filters, view and closing the drawer
 * replace the history entry; opening a lead pushes one, so the browser's
 * Back button closes the drawer. Written with the native history API (Next
 * keeps useSearchParams in sync), so nothing refetches on the server. The
 * view is also remembered in localStorage ("sp-leads-view").
 */
export function useLeadsParams(): [
  LeadsParams,
  (patch: Partial<LeadsParams>) => void,
] {
  const searchParams = useSearchParams()
  const registry = useUnsavedRegistry()
  const url = searchParams?.toString() ?? ""
  const storedView = useSyncExternalStore(
    subscribeView,
    readStoredView,
    () => null
  )
  // Our own writes show at once; Back/Forward or a link that changes the URL
  // is followed (adjusted during render).
  const [search, setSearch] = useState(url)
  const [seenUrl, setSeenUrl] = useState(url)
  // A drawer closing by stepping back: the `?lead=` entries it passes are
  // not shown (no flash of the drawer).
  const [closing, setClosing] = useState(false)
  if (seenUrl !== url) {
    setSeenUrl(url)
    if (!closing) setSearch(url)
  }
  // Every entry this screen shows is marked as this document's.
  useEffect(() => {
    stampEntry()
  }, [url])
  // A close still stepping back when the screen goes away stops listening
  // (it must not rewrite another page's URL; D3.3 re-review N3).
  const closeListener = useRef<(() => void) | null>(null)
  useEffect(
    () => () => {
      if (closeListener.current)
        window.removeEventListener("popstate", closeListener.current)
      closeListener.current = null
    },
    []
  )

  /**
   * Closes lead `id`'s drawer by stepping back over the entries this
   * document wrote for it (its opening, a note's guard entry), checking the
   * state of each landing entry instead of counting. Where one still shows
   * the lead (opened by URL), it is replaced with the list. `rest`: the
   * patch's other changes, applied on the landing entry.
   */
  const closeByBack = (
    id: string,
    rest: Record<string, string | undefined>,
    keepPage: boolean
  ) => {
    setClosing(true)
    // Closing was confirmed (or nothing was typed): the note's Back guard
    // must not ask, nor step back itself, on the entries passed here.
    registry?.release(leadGuardScope(id))
    let steps = 1
    const onPopState = () => {
      if (
        parseLeadsParams(window.location.search).lead === id &&
        steps < MAX_CLOSE_STEPS &&
        isDrawerEntry(id)
      ) {
        steps += 1
        window.history.back()
        return
      }
      window.removeEventListener("popstate", onPopState)
      closeListener.current = null
      const final = mergeListSearch(
        window.location.search,
        parseLeadsParams(window.location.search).lead === id
          ? { ...rest, lead: undefined }
          : rest,
        { keepPage }
      )
      setClosing(false)
      setSearch(final)
      replaceListSearch(final)
    }
    if (closeListener.current)
      window.removeEventListener("popstate", closeListener.current)
    closeListener.current = onPopState
    window.addEventListener("popstate", onPopState)
    window.history.back()
  }

  const update = (patch: Partial<LeadsParams>) => {
    const changes = searchPatch(patch)
    // A new folder or filter starts at page 1 (unless a page is given).
    const filterChange =
      "folder" in patch || "status" in patch || "assignee" in patch
    const keepPage = !filterChange || "page" in patch
    const next = mergeListSearch(window.location.search, changes, {
      keepPage,
    })
    if (patch.view) storeView(patch.view)
    setSearch(next)
    if (changes.lead) {
      const { pathname, hash } = window.location
      // Marked, so closing can step back off it (D3.2 review I1).
      window.history.pushState(
        { [DRAWER_KEY]: changes.lead, [DOC_KEY]: DOC },
        "",
        `${pathname}${next ? `?${next}` : ""}${hash}`
      )
      return
    }
    const openLead = parseLeadsParams(window.location.search).lead
    if (
      "lead" in patch &&
      !changes.lead &&
      openLead &&
      isDrawerEntry(openLead)
    ) {
      // Closing a drawer this document opened: back to the list's entry, so
      // no `?lead=` entry is left behind for Back to reopen. After a reload
      // (entries of another document) it is replaced instead.
      const rest = { ...changes }
      delete rest.lead
      closeByBack(openLead, rest, keepPage)
      return
    }
    replaceListSearch(next)
  }

  return [parseLeadsParams(search, storedView), update]
}
