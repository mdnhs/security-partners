"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { formatNumber } from "@/components/admin/kit/format"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"

// 36 px; 44 px on touch screens (WCAG 2.5.8 / 2.5.5).
const PAGE_BUTTON = "size-9 bg-card pointer-coarse:size-11"

/** "21–40 of 45" and a chevron pair (JW). Pages are 1-based. */
export function DataTablePagination({
  page: requested,
  pageSize,
  total,
  onPageChange,
  disabled = false,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** While the requested page is still loading (no double steps). */
  disabled?: boolean
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requested, pageCount)
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p aria-live="polite" className="text-muted-foreground tabular-nums">
        {total === 0
          ? "No results"
          : `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(total)}`}
      </p>
      <ButtonGroup>
        <Button
          type="button"
          variant="outline"
          className={PAGE_BUTTON}
          aria-label="Previous page"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          className={PAGE_BUTTON}
          aria-label="Next page"
          disabled={disabled || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </ButtonGroup>
    </nav>
  )
}
