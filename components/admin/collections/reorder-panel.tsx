"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import {
  type SortableItem,
  SortableList,
} from "@/components/admin/sortable-list"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { Reorderable } from "@/lib/schemas/api/collections"
import { type Paginated, PAGE_SIZE_MAX } from "@/lib/schemas/api/list"

/** PUT /reorder accepts at most this many ids (reorderInput). */
export const REORDER_MAX_ITEMS = 500

/**
 * Every record, page by page (the list API caps pageSize at 100): reorder
 * must send the complete id set or the API answers 409. Collections are
 * small; past REORDER_MAX_ITEMS the order cannot be saved, so it throws.
 */
export async function loadAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<Paginated<T>>
): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const result = await fetchPage(page, PAGE_SIZE_MAX)
    items.push(...result.items)
    if (result.total > REORDER_MAX_ITEMS)
      throw new Error(
        `Too many records to reorder here (${result.total}; the limit is ${REORDER_MAX_ITEMS}).`
      )
    if (items.length >= result.total || result.items.length === 0) return items
  }
}

/**
 * Display-order editor for a whole collection: drag or move items, then
 * "Save order" (PUT /reorder/:collection). The site updates immediately.
 */
export function ReorderPanel({
  collection,
  label,
  queryKey,
  load,
  onDone,
}: {
  collection: Reorderable
  label: string
  queryKey: readonly unknown[]
  /** Every record in the current display order. */
  load: () => Promise<SortableItem[]>
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const all = useQuery({
    queryKey: [...queryKey, "all"],
    queryFn: load,
    staleTime: 0,
  })
  const [order, setOrder] = useState<SortableItem[] | null>(null)
  const items = order ?? all.data ?? []
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.reorder[":collection"].$put({
          param: { collection },
          json: { ids: items.map((i) => i.id) },
        })
      ),
    onSuccess: async () => {
      toast.success("Order saved", {
        description: "The site shows the new order now.",
      })
      await queryClient.invalidateQueries({ queryKey })
      onDone()
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.isConflict) {
        toast.error("The list changed meanwhile", {
          description: "It was reloaded. Arrange it again and save.",
        })
        setOrder(null)
        await all.refetch()
        return
      }
      toast.error("Order not saved", { description: errorMessage(error) })
    },
  })
  if (all.isPending)
    return (
      <div
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Loading"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  if (all.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        {all.error instanceof ApiError || !(all.error instanceof Error)
          ? errorMessage(all.error)
          : all.error.message}
      </p>
    )
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Drag the handle, or use the arrow buttons. Keyboard: focus a handle,
        press space, use the arrow keys, press space again.
      </p>
      <SortableList
        label={label}
        items={items}
        onReorder={setOrder}
        disabled={save.isPending}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={order === null || save.isPending}
          onClick={() => save.mutate()}
        >
          Save order
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
