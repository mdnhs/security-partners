"use client"

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react"
import { useId, useRef } from "react"

import { COARSE_ICON } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"

export type SortableItem = { id: string; label: string; description?: string }

/**
 * Reorder records (sortOrder) by drag, keyboard (space + arrows) or the
 * Move up / Move down buttons (WCAG 2.2 SC 2.5.7 single-pointer
 * alternative). Calls `onReorder` with the full new order.
 */
export function SortableList({
  label,
  items,
  onReorder,
  disabled = false,
}: {
  label: string
  items: SortableItem[]
  onReorder: (next: SortableItem[]) => void
  disabled?: boolean
}) {
  const dndId = useId()
  const listRef = useRef<HTMLOListElement>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const nameOf = (id: string | number) =>
    items.find((i) => i.id === id)?.label ?? String(id)
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${nameOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at the place of ${nameOf(over.id)}.`
        : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} cancelled.`,
  }

  function move(from: number, to: number, focus?: "up" | "down") {
    if (to < 0 || to >= items.length || from === to) return
    const id = items[from].id
    onReorder(arrayMove(items, from, to))
    if (focus)
      requestAnimationFrame(() =>
        listRef.current
          ?.querySelector<HTMLElement>(`[data-focus-key="${id}:${focus}"]`)
          ?.focus()
      )
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    move(
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id)
    )
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Press space to pick up. Use the arrow keys to move, space to drop, escape to cancel. Or use the Move up and Move down buttons.",
        },
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol ref={listRef} aria-label={label} className="flex flex-col gap-2">
          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              index={index}
              count={items.length}
              disabled={disabled}
              onMove={(to, focus) => move(index, to, focus)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function Row({
  item,
  index,
  count,
  disabled,
  onMove,
}: {
  item: SortableItem
  index: number
  count: number
  disabled: boolean
  onMove: (to: number, focus: "up" | "down") => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border bg-card p-2 ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${item.label}`}
        className="flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{item.label}</span>
        {item.description ? (
          <span className="truncate text-xs text-muted-foreground">
            {item.description}
          </span>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={COARSE_ICON}
        aria-label={`Move ${item.label} up`}
        data-focus-key={`${item.id}:up`}
        disabled={disabled || index === 0}
        onClick={() => onMove(index - 1, "up")}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={COARSE_ICON}
        aria-label={`Move ${item.label} down`}
        data-focus-key={`${item.id}:down`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(index + 1, "down")}
      >
        <ArrowDown aria-hidden />
      </Button>
    </li>
  )
}
