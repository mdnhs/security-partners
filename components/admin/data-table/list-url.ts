"use client"

import { useSearchParams } from "next/navigation"
import { useState, useSyncExternalStore } from "react"

/**
 * List state in the URL (final review I8): a list keeps its page, sort,
 * search and filters in its query string, and remembers the last one per
 * list path (sessionStorage, this tab only), so a record's "back to the
 * list" link returns to the same page of the same filtered list.
 */

const STORAGE_PREFIX = "sp-admin:list:"

/** DataTable's own query keys. */
export const LIST_PAGE = "page"
export const LIST_SORT = "sort"
export const LIST_QUERY = "q"

export function rememberListSearch(pathname: string, search: string): void {
  try {
    const key = `${STORAGE_PREFIX}${pathname}`
    if (search) window.sessionStorage.setItem(key, search)
    else window.sessionStorage.removeItem(key)
  } catch {
    // Storage blocked (private mode, policy): links fall back to the bare list.
  }
}

function readListSearch(pathname: string): string {
  try {
    return window.sessionStorage.getItem(`${STORAGE_PREFIX}${pathname}`) ?? ""
  } catch {
    return ""
  }
}

const noSubscribe = () => () => {}

/**
 * The list's URL as last seen in this tab (`/admin/leads?status=open&page=3`),
 * or the bare `pathname` on the server and before the list was opened.
 */
export function useListHref(pathname: string): string {
  const search = useSyncExternalStore(
    noSubscribe,
    () => readListSearch(pathname),
    () => ""
  )
  return search ? `${pathname}?${search}` : pathname
}

/**
 * `current` with `patch` applied (undefined/"" removes a key) and, unless
 * `keepPage`, the page reset: a new filter starts at page 1.
 */
export function mergeListSearch(
  current: string,
  patch: Record<string, string | undefined>,
  { keepPage = false }: { keepPage?: boolean } = {}
): string {
  const params = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch))
    if (value) params.set(key, value)
    else params.delete(key)
  if (!keepPage) params.delete(LIST_PAGE)
  return params.toString()
}

/**
 * Replaces this page's query string without a navigation (the native
 * history API: Next keeps useSearchParams in sync, nothing refetches) and
 * remembers it for back links.
 */
export function replaceListSearch(search: string): void {
  const { pathname, hash } = window.location
  if (search === window.location.search.replace(/^\?/, "")) return
  window.history.replaceState(
    null,
    "",
    `${pathname}${search ? `?${search}` : ""}${hash}`
  )
  rememberListSearch(pathname, search)
}

/**
 * A screen's own list filters (`keys`) kept in the URL: read once from it,
 * then held locally (instant UI) and written back with `replaceListSearch`.
 * Changing a filter returns the list to page 1.
 */
export function useUrlFilters<K extends string>(
  keys: readonly K[]
): [Record<K, string>, (patch: Partial<Record<K, string>>) => void] {
  const searchParams = useSearchParams()
  const [values, setValues] = useState(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    return Object.fromEntries(
      keys.map((key) => [key, params.get(key) ?? ""])
    ) as Record<K, string>
  })
  const update = (patch: Partial<Record<K, string>>) => {
    setValues((current) => ({ ...current, ...patch }))
    replaceListSearch(
      mergeListSearch(
        window.location.search,
        patch as Record<string, string | undefined>
      )
    )
  }
  return [values, update]
}
