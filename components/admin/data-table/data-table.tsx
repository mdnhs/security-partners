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
import { type ReactNode, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
  empty: ReactNode
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? [])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 250)
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
  })
  const rows = query.data?.items ?? EMPTY_ROWS
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

  const total = query.data?.total ?? 0
  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder={searchPlaceholder}
          className="pl-8"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPagination((p) => ({ ...p, pageIndex: 0 }))
          }}
        />
      </div>

      {query.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border p-6"
        >
          <p className="text-sm">{errorMessage(query.error)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : query.isPending ? (
        <div
          className="flex flex-col gap-2"
          aria-busy="true"
          aria-label={`Loading ${label.toLowerCase()}`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Inbox aria-hidden className="size-6" />
          {q ? `Nothing matches “${q}”.` : empty}
        </div>
      ) : (
        <>
          <div
            className={cn(
              "hidden overflow-x-auto rounded-xl border bg-card sm:block",
              query.isPlaceholderData && "opacity-60"
            )}
          >
            <table className="w-full text-sm">
              <caption className="sr-only">{label}</caption>
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
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
                          className="px-4 py-3 font-semibold"
                        >
                          {header.isPlaceholder ? null : sortable ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 rounded uppercase outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
          <ul aria-label={label} className="flex flex-col gap-2 sm:hidden">
            {rows.map((row) => (
              <li key={row.id}>{renderCard(row as T)}</li>
            ))}
          </ul>
        </>
      )}

      <nav
        aria-label="Pagination"
        className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
      >
        <span aria-live="polite">
          {total === 0 ? "No results" : `${from}–${to} of ${total}`}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      </nav>
    </div>
  )
}

const EMPTY_ROWS: never[] = []
