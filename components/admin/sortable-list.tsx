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
import { type ReactNode, useId, useRef } from "react"

import { COARSE_ICON } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SortableItem = { id: string; label: string; description?: string }

type RowRender<T extends SortableItem> = (item: T, index: number) => ReactNode

/**
 * Reorder records (sortOrder) by drag, keyboard (space + arrows) or the
 * Move up / Move down buttons (WCAG 2.2 SC 2.5.7 single-pointer
 * alternative). Calls `onReorder` with the full new order and `onMove`
 * with the moved id and its new index.
 */
export function SortableList<T extends SortableItem>({
  label,
  items,
  onReorder,
  onMove,
  disabled = false,
  fixedLeading = 0,
  renderContent,
  actions,
  rowClassName,
}: {
  label: string
  items: T[]
  onReorder?: (next: T[]) => void
  onMove?: (id: string, to: number) => void
  disabled?: boolean
  /** The first N items stay in place; nothing moves above them. */
  fixedLeading?: number
  /** Replaces the label / description column (e.g. a select button). */
  renderContent?: RowRender<T>
  /** Extra controls after Move up / Move down. */
  actions?: RowRender<T>
  rowClassName?: (item: T, index: number) => string | undefined
}) {
  const dndId = useId()
  const listRef = useRef<HTMLOListElement>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const indexOf = (id: string | number) => items.findIndex((i) => i.id === id)
  const nameOf = (id: string | number) =>
    items.find((i) => i.id === id)?.label ?? String(id)
  const position = (id: string | number) =>
    `position ${indexOf(id) + 1} of ${items.length}`
  // dnd-kit reports "over itself" right after pick-up; announcing it would
  // replace the "Picked up" message in the live region.
  const justPicked = useRef(false)
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      justPicked.current = true
      return `Picked up ${nameOf(active.id)}, ${position(active.id)}.`
    },
    onDragOver: ({ active, over }) => {
      const first = justPicked.current
      justPicked.current = false
      if (first && over?.id === active.id) return undefined
      return over
        ? `${nameOf(active.id)} is over ${position(over.id)}.`
        : `${nameOf(active.id)} is no longer over a position.`
    },
    onDragEnd: ({ active, over }) =>
      !over
        ? `${nameOf(active.id)} dropped.`
        : over.id === active.id
          ? `${nameOf(active.id)} dropped, ${position(active.id)}, unchanged.`
          : `${nameOf(active.id)} moved to ${position(over.id)}.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} cancelled.`,
  }

  function move(from: number, to: number, focus?: "up" | "down") {
    if (from < fixedLeading) return
    to = Math.max(to, fixedLeading)
    if (to < 0 || to >= items.length || from === to) return
    const id = items[from].id
    onReorder?.(arrayMove(items, from, to))
    onMove?.(id, to)
    if (focus)
      requestAnimationFrame(() =>
        listRef.current
          ?.querySelector<HTMLElement>(`[data-focus-key="${id}:${focus}"]`)
          ?.focus()
      )
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    move(indexOf(active.id), indexOf(over.id))
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
              fixed={index < fixedLeading}
              firstMovable={fixedLeading}
              className={rowClassName?.(item, index)}
              content={renderContent?.(item, index)}
              actions={actions?.(item, index)}
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
  fixed,
  firstMovable,
  className,
  content,
  actions,
  onMove,
}: {
  item: SortableItem
  index: number
  count: number
  disabled: boolean
  fixed: boolean
  firstMovable: number
  className?: string
  content?: ReactNode
  actions?: ReactNode
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
    disabled: disabled || fixed,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        // Wraps only when a row's content sets a basis (the builder outline
        // at 320 px): the controls then move to a line of their own.
        "flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2",
        isDragging && "z-10 shadow-lg",
        className
      )}
    >
      {fixed ? (
        <span aria-hidden className="size-8 shrink-0 pointer-coarse:size-11" />
      ) : (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${item.label}`}
          className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50 pointer-coarse:size-11"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      )}
      <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      {content ?? (
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{item.label}</span>
          {item.description ? (
            <span className="truncate text-xs text-muted-foreground">
              {item.description}
            </span>
          ) : null}
        </div>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {fixed ? null : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={COARSE_ICON}
              aria-label={`Move ${item.label} up`}
              data-focus-key={`${item.id}:up`}
              disabled={disabled || index <= firstMovable}
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
          </>
        )}
        {actions}
      </div>
    </li>
  )
}
