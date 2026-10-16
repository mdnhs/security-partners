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
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useController, useFormContext, useWatch } from "react-hook-form"
import type { z } from "zod"

import { Button } from "@/components/ui/button"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { emptyValue } from "../empty-value"
import { toFormValues } from "../optional-values"
import { Field } from "../field"
import { arrayBounds } from "../resolve-widget"
import { errorText } from "./field-shell"

export function GroupWidget({ field, path }: WidgetProps) {
  const { idPrefix } = useSchemaForm()
  const shape = (field.schema as z.ZodObject).shape as Record<string, z.ZodType>
  const children = Object.entries(shape).map(([key, child]) => (
    <Field
      key={key}
      schema={child}
      name={key}
      path={path ? `${path}.${key}` : key}
    />
  ))
  if (!path) return <div className="flex flex-col gap-6">{children}</div>
  // A list item's object: the item card already titles it.
  if (/\.\d+$/.test(path))
    return <div className="flex flex-col gap-4">{children}</div>
  const id = fieldId(idPrefix, path)
  const section = field.meta.section ?? !path.includes(".")
  if (section)
    return (
      <section
        aria-labelledby={`${id}-title`}
        className="flex flex-col gap-5 rounded-xl border bg-card p-4 shadow-xs sm:p-6"
      >
        <header className="flex flex-col gap-1">
          <h2 id={`${id}-title`} className="text-base font-bold">
            {field.label}
          </h2>
          {field.meta.help ? (
            <p className="text-sm text-muted-foreground">{field.meta.help}</p>
          ) : null}
        </header>
        {children}
      </section>
    )
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-dashed p-4">
      <legend className="px-1 text-sm font-semibold">{field.label}</legend>
      {field.meta.help ? (
        <p className="-mt-2 text-sm text-muted-foreground">{field.meta.help}</p>
      ) : null}
      {children}
    </fieldset>
  )
}

let keySeed = 0
const newKey = () => `item-${++keySeed}`

/** `keys` resized to `length` (after an outside reset) without changing kept keys. */
function fitKeys(keys: string[], length: number): string[] {
  if (keys.length === length) return keys
  return Array.from({ length }, (_, i) => keys[i] ?? `fill-${i}`)
}

export function ListWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const { trigger } = useFormContext()
  const { field: f, fieldState } = useController({ name: path })
  const items = Array.isArray(f.value) ? (f.value as unknown[]) : []
  // Stable React keys per item, moved together with the items.
  const [storedKeys, setKeys] = useState<string[]>(() =>
    items.map(() => newKey())
  )
  const keys = fitKeys(storedKeys, items.length)
  const element = (field.schema as z.ZodArray<z.ZodType>).element
  const { min, max } = arrayBounds(field.schema)
  const itemName = field.meta.itemName ?? "Item"
  const id = fieldId(idPrefix, path)
  const dndId = useId()
  const listRef = useRef<HTMLOListElement>(null)

  /** Keyboard users keep their place: focus moves with the item. */
  function focusLater(focusKey: string) {
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)
        ?.focus()
    )
  }
  function commit(nextItems: unknown[], nextKeys: string[]) {
    setKeys(nextKeys)
    f.onChange(nextItems)
    void trigger(path)
  }
  function add() {
    const key = newKey()
    commit(
      [...items, toFormValues(element, emptyValue(element))],
      [...keys, key]
    )
    focusLater(`${key}:first`)
  }
  function remove(index: number) {
    commit(
      items.filter((_, i) => i !== index),
      keys.filter((_, i) => i !== index)
    )
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return
    commit(arrayMove(items, from, to), arrayMove(keys, from, to))
    focusLater(`${keys[from]}:${to < from ? "up" : "down"}`)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const labelFor = (key: string | number) => {
    const index = keys.indexOf(String(key))
    return `${itemName} ${index + 1}`
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelFor(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${labelFor(active.id)} is over ${labelFor(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelFor(active.id)} dropped at ${labelFor(over.id)}.`
        : `${labelFor(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${labelFor(active.id)} cancelled.`,
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    move(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)))
  }
  const error = errorText(fieldState.error)

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {field.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      {field.meta.help ? (
        <p className="-mt-2 text-sm text-muted-foreground">{field.meta.help}</p>
      ) : null}
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
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <ol ref={listRef} className="flex flex-col gap-3">
            {items.map((_, index) => (
              <ListItem
                key={keys[index]}
                sortId={keys[index]}
                path={`${path}.${index}`}
                element={element}
                index={index}
                count={items.length}
                itemName={itemName}
                itemLabel={field.meta.itemLabel}
                canRemove={!disabled && items.length > min}
                disabled={disabled}
                onMove={(to) => move(index, to)}
                onRemove={() => remove(index)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || items.length >= max}
          onClick={add}
        >
          <Plus aria-hidden />
          Add {itemName.toLowerCase()}
        </Button>
      </div>
    </div>
  )
}

function ListItem({
  sortId,
  path,
  element,
  index,
  count,
  itemName,
  itemLabel,
  canRemove,
  disabled,
  onMove,
  onRemove,
}: {
  sortId: string
  path: string
  element: z.ZodType
  index: number
  count: number
  itemName: string
  itemLabel?: string
  canRemove: boolean
  disabled: boolean
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortId, disabled })
  const title = useWatch({
    name: itemLabel ? `${path}.${itemLabel}` : path,
  }) as unknown
  const position = `${itemName} ${index + 1}`
  const heading =
    itemLabel && typeof title === "string" && title.trim()
      ? `${position}: ${title}`
      : position
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex flex-col gap-3 rounded-lg border bg-background p-3 ${isDragging ? "z-10 shadow-lg" : ""}`}
      aria-label={position}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${position}`}
          className="flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {heading}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${position} up`}
          data-focus-key={`${sortId}:up`}
          disabled={disabled || index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${position} down`}
          data-focus-key={`${sortId}:down`}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${position}`}
          disabled={!canRemove}
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div
        data-focus-key={`${sortId}:first`}
        tabIndex={-1}
        className="flex flex-col gap-4 outline-none"
      >
        <Field schema={element} name={position} path={path} />
      </div>
    </li>
  )
}
