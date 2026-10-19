"use client"

import { useSearchParams } from "next/navigation"
import { useState, useSyncExternalStore } from "react"

import {
  LIST_PAGE,
  LIST_QUERY,
  mergeListSearch,
  replaceListSearch,
} from "@/components/admin/data-table/list-url"
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
  if (seenUrl !== url) {
    setSeenUrl(url)
    setSearch(url)
  }

  const update = (patch: Partial<LeadsParams>) => {
    const changes = searchPatch(patch)
    // A new folder or filter starts at page 1 (unless a page is given).
    const filterChange =
      "folder" in patch || "status" in patch || "assignee" in patch
    const next = mergeListSearch(window.location.search, changes, {
      keepPage: !filterChange || "page" in patch,
    })
    if (patch.view) storeView(patch.view)
    setSearch(next)
    if (changes.lead) {
      const { pathname, hash } = window.location
      window.history.pushState(
        null,
        "",
        `${pathname}${next ? `?${next}` : ""}${hash}`
      )
    } else replaceListSearch(next)
  }

  return [parseLeadsParams(search, storedView), update]
}
