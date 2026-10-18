"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  type ColumnDef,
  createColumnHelper,
  type PaginationState,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, Search } from "lucide-react"
import { type ReactNode, useId, useState } from "react"

import { DataTablePagination } from "@/components/admin/data-table/data-table-pagination"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { NowProvider } from "@/components/admin/kit/relative-time"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { FORM_ACTION } from "@/components/admin/page-header"
import { useInSectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { errorMessage } from "@/lib/api-client"
import type { Paginated } from "@/lib/schemas/api/list"
import { cn } from "@/lib/utils"

/**
 * Server-side pagination + sorting (TanStack Table v9, notes §4.1): no
 * sorted/paginated row models, so the table only renders what the API
 * returned for the current page.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
})
export type DataTableFeatures = typeof dataTableFeatures

/** Column helper bound to the admin table features. */
export const columnsFor = <T extends Record<string, unknown>>() =>
  createColumnHelper<DataTableFeatures, T>()

export type DataTableColumns<T extends Record<string, unknown>> = ColumnDef<
  DataTableFeatures,
  T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columns of mixed value types
  any
>[]

export type DataTableParams = {
  page: number
  pageSize: number
  sort?: string
  q?: string
}

const PAGE_SIZE = 20

/**
 * Admin list: search, sortable headers, pagination; a table from 640 px
 * and cards below it (spec §8.2 "tables → cards on phones").
 */
export function DataTable<T extends Record<string, unknown> & { id: string }>({
  label,
  queryKey,
  fetchPage,
  columns,
  renderCard,
  initialSort,
  searchPlaceholder = "Search",
  empty,
  emptyDescription,
  emptyAction,
  toolbar,
  filterKey = "",
  filteredEmpty = "Nothing matches these filters",
}: {
  /** Accessible name (table caption, list label). */
  label: string
  queryKey: readonly unknown[]
  fetchPage: (params: DataTableParams) => Promise<Paginated<T>>
  /** Module-scope (stable) column definitions. */
  columns: DataTableColumns<T>
  renderCard: (row: T) => ReactNode
  initialSort?: SortingState
  searchPlaceholder?: string
  /** Empty-list title, e.g. "No categories yet". */
  empty: string
  /** Optional hint under it (where records appear, how to add one). */
  emptyDescription?: ReactNode
  /** Call to action in the empty state (e.g. "Add category"); omit for read-only users. */
  emptyAction?: ReactNode
  /** Extra filter controls shown beside the search box (labelled selects/inputs). */
  toolbar?: ReactNode
  /**
   * Identity of the active extra filters ("" = none). The caller puts the
   * filters into `queryKey` and `fetchPage`; a new key returns to page 1.
   */
  filterKey?: string
  /** Empty-list title while extra filters are active. */
  filteredEmpty?: string
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? [])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 250)
  // Back to page 1 when the debounced query changes (adjusted during render,
  // so no request goes out for the new page with the old query or vice versa).
  const [pagedQ, setPagedQ] = useState(q)
  if (pagedQ !== q) {
    setPagedQ(q)
    if (pagination.pageIndex !== 0)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
  }
  // Likewise for the caller's extra filters.
  const [pagedFilterKey, setPagedFilterKey] = useState(filterKey)
  if (pagedFilterKey !== filterKey) {
    setPagedFilterKey(filterKey)
    if (pagination.pageIndex !== 0)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
  }
  const sort = sorting[0]
    ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
    : undefined
  const params: DataTableParams = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sort,
    q: q || undefined,
  }

  const query = useQuery({
    queryKey: [...queryKey, "list", params],
    queryFn: () => fetchPage(params),
    placeholderData: keepPreviousData,
    // Editors elsewhere change status/titles: show the cache, then refresh.
    staleTime: 0,
  })
  const rows = query.data?.items ?? EMPTY_ROWS
  // A page past the end (last row deleted, list shrank): go to the last page.
  if (
    query.data &&
    !query.isPlaceholderData &&
    rows.length === 0 &&
    query.data.total > 0 &&
    pagination.pageIndex > 0
  ) {
    const last = Math.max(
      0,
      Math.ceil(query.data.total / pagination.pageSize) - 1
    )
    if (last !== pagination.pageIndex)
      setPagination((p) => ({ ...p, pageIndex: last }))
  }
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows as T[],
    rowCount: query.data?.total ?? 0,
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting(updater)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
  })

  const sortId = useId()
  // Phones get a select instead of sortable headers (cards have no headers).
  const sortOptions = table.getAllLeafColumns().flatMap((column) => {
    if (!column.getCanSort()) return []
    const name =
      typeof column.columnDef.header === "string"
        ? column.columnDef.header
        : column.id
    return [
      { value: `${column.id}:asc`, label: `${name} (ascending)` },
      { value: `${column.id}:desc`, label: `${name} (descending)` },
    ]
  })

  const total = query.data?.total ?? 0
  // On a section tab's white card a second white card would vanish: outline it.
  const onCard = useInSectionTabs()

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-wrap gap-3",
          // Labelled filters stand above their controls: line up the bottoms.
          toolbar ? "items-end" : "items-center"
        )}
      >
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder={searchPlaceholder}
            className="h-10 rounded-xl bg-card pl-9 pointer-coarse:h-11"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {sortOptions.length ? (
          <div className="flex w-full items-center gap-2 text-sm sm:hidden">
            <label htmlFor={sortId} className="text-muted-foreground">
              Sort by
            </label>
            <select
              id={sortId}
              value={sort ?? ""}
              onChange={(event) => {
                const [id, dir] = event.target.value.split(":")
                setSorting(id ? [{ id, desc: dir === "desc" }] : [])
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11"
            >
              <option value="">Default order</option>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {toolbar}
      </div>

      {query.isError ? (
        <EmptyState
          role="alert"
          title={`The ${label.toLowerCase()} didn't load`}
          description={errorMessage(query.error)}
          action={
            <Button
              type="button"
              className={FORM_ACTION}
              onClick={() => query.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <div role="status">
          <span className="sr-only">Loading {label.toLowerCase()}…</span>
          <CardSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          role={q || filterKey ? "status" : undefined}
          title={q ? "No matches" : filterKey ? filteredEmpty : empty}
          description={
            q
              ? `Nothing matches “${q}”.`
              : filterKey
                ? "Try different filters or clear them."
                : emptyDescription
          }
          action={q || filterKey ? undefined : emptyAction}
        />
      ) : (
        // Relative dates count from the last fetch (moves on with refetches).
        <NowProvider now={query.dataUpdatedAt}>
          <div
            className={cn(
              "flex flex-col gap-3 transition-opacity",
              query.isPlaceholderData && "opacity-60"
            )}
          >
            {/*
             * The next page is loading (the old rows stay, dimmed). Announced
             * by a live region, not aria-busy on the table: a live region
             * around the whole table would read every row out.
             */}
            <p role="status" className="sr-only">
              {query.isPlaceholderData
                ? `Loading ${label.toLowerCase()}…`
                : null}
            </p>
            <div
              data-slot="table-card"
              className={cn(
                "rounded-card hidden overflow-x-auto bg-card sm:block",
                onCard && "border"
              )}
            >
              <table className="w-full text-sm">
                <caption className="sr-only">{label}</caption>
                <thead className="border-b text-left text-muted-foreground">
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => {
                        const sortable = header.column.getCanSort()
                        const dir = header.column.getIsSorted()
                        return (
                          <th
                            key={header.id}
                            scope="col"
                            aria-sort={
                              dir === "asc"
                                ? "ascending"
                                : dir === "desc"
                                  ? "descending"
                                  : sortable
                                    ? "none"
                                    : undefined
                            }
                            className="h-12 px-4 font-medium"
                          >
                            {header.isPlaceholder ? null : sortable ? (
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                className="inline-flex items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                              >
                                <table.FlexRender header={header} />
                                {dir === "asc" ? (
                                  <ArrowUp aria-hidden className="size-3.5" />
                                ) : dir === "desc" ? (
                                  <ArrowDown aria-hidden className="size-3.5" />
                                ) : (
                                  <ArrowUpDown
                                    aria-hidden
                                    className="size-3.5 opacity-50"
                                  />
                                )}
                              </button>
                            ) : (
                              <table.FlexRender header={header} />
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/40">
                      {row.getAllCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-middle">
                          <table.FlexRender cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul aria-label={label} className="flex flex-col gap-3 sm:hidden">
              {rows.map((row) => (
                <li key={row.id}>{renderCard(row as T)}</li>
              ))}
            </ul>
          </div>
        </NowProvider>
      )}

      {query.isPending || query.isError ? null : (
        <DataTablePagination
          page={pagination.pageIndex + 1}
          pageSize={pagination.pageSize}
          total={total}
          disabled={query.isPlaceholderData}
          onPageChange={(next) =>
            setPagination((p) => ({ ...p, pageIndex: next - 1 }))
          }
        />
      )}
    </div>
  )
}

const EMPTY_ROWS: never[] = []
