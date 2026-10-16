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
import {
  get,
  useController,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form"
import type { z } from "zod"

import { Button } from "@/components/ui/button"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { emptyValue } from "../empty-value"
import { toFormValues } from "../optional-values"
import { Field } from "../field"
import { arrayBounds } from "../resolve-widget"
import { deepErrorText, describedBy, errorText } from "./field-shell"

/**
 * Errors a group shows itself: one on the group path (e.g. a server message
 * for "hero") and ones on keys no child widget renders.
 */
function useGroupErrors(path: string, shape: Record<string, z.ZodType>) {
  const { errors } = useFormState({ name: path, disabled: !path })
  if (!path) return []
  const own = get(errors, path) as unknown
  if (!own || typeof own !== "object") return []
  const messages: string[] = []
  const self = errorText(own)
  if (self) messages.push(self)
  for (const [key, child] of Object.entries(own))
    if (!["message", "type", "ref", "root", "types"].includes(key))
      if (!Object.hasOwn(shape, key)) {
        const text = deepErrorText(child)
        if (text) messages.push(text)
      }
  return messages
}

function GroupErrors({ id, messages }: { id: string; messages: string[] }) {
  if (!messages.length) return null
  return (
    <div id={id} role="alert" className="flex flex-col gap-1">
      {messages.map((message) => (
        <p key={message} className="text-sm text-destructive">
          {message}
        </p>
      ))}
    </div>
  )
}

export function GroupWidget({ field, path }: WidgetProps) {
  const { idPrefix } = useSchemaForm()
  const shape = (field.schema as z.ZodObject).shape as Record<string, z.ZodType>
  const groupErrors = useGroupErrors(path, shape)
  const children = Object.entries(shape).map(([key, child]) => (
    <Field
      key={key}
      schema={child}
      name={key}
      path={path ? `${path}.${key}` : key}
    />
  ))
  if (!path) return <div className="flex flex-col gap-6">{children}</div>
  const id = fieldId(idPrefix, path)
  const errorId = `${id}-error`
  const errors = <GroupErrors id={errorId} messages={groupErrors} />
  const errorRef = groupErrors.length ? errorId : undefined
  // A list item's object: the item card already titles it.
  if (/\.\d+$/.test(path))
    return (
      <div className="flex flex-col gap-4">
        {errors}
        {children}
      </div>
    )
  const section = field.meta.section ?? !path.includes(".")
  if (section)
    return (
      <section
        aria-labelledby={`${id}-title`}
        aria-describedby={errorRef}
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
        {errors}
        {children}
      </section>
    )
  return (
    <fieldset
      aria-describedby={errorRef}
      className="flex flex-col gap-4 rounded-lg border border-dashed p-4"
    >
      <legend className="px-1 text-sm font-semibold">{field.label}</legend>
      {field.meta.help ? (
        <p className="-mt-2 text-sm text-muted-foreground">{field.meta.help}</p>
      ) : null}
      {errors}
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
  const { trigger, getValues, getFieldState, clearErrors } = useFormContext()
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

  /**
   * Keyboard users keep their place: focus the first of `targets` that is
   * enabled after React re-renders (a moved item's Move button may now be
   * disabled at the top/bottom of the list).
   */
  function focusLater(...targets: string[]) {
    requestAnimationFrame(() => {
      for (const target of targets) {
        const element = target.startsWith("#")
          ? document.getElementById(target.slice(1))
          : listRef.current?.querySelector<HTMLElement>(
              `[data-focus-key="${target}"]`
            )
        if (element && !(element as HTMLButtonElement).disabled) {
          element.focus()
          return
        }
      }
    })
  }
  /**
   * The array as it is now. useController only re-renders on changes to the
   * array itself, so `items` from render can predate edits inside the items.
   */
  function current(): unknown[] {
    const value = getValues(path) as unknown
    return Array.isArray(value) ? value : []
  }
  function commit(nextItems: unknown[], nextKeys: string[]) {
    // Re-check the list (min/max, moved items) but only show item errors
    // the user had already been shown; a new or untouched item stays quiet.
    const shown = new Set(
      keys.filter((_, i) => getFieldState(`${path}.${i}`).invalid)
    )
    setKeys(nextKeys)
    f.onChange(nextItems)
    void trigger(path).then(() =>
      nextKeys.forEach((key, i) => {
        if (!shown.has(key)) clearErrors(`${path}.${i}`)
      })
    )
  }
  function add() {
    const key = newKey()
    commit(
      [...current(), toFormValues(element, emptyValue(element))],
      [...keys, key]
    )
    focusLater(`${key}:first`)
  }
  function remove(index: number) {
    const nextKeys = keys.filter((_, i) => i !== index)
    commit(
      current().filter((_, i) => i !== index),
      nextKeys
    )
    const neighbour = nextKeys[index] ?? nextKeys[index - 1]
    focusLater(...(neighbour ? [`${neighbour}:handle`] : []), `#${id}-add`)
  }
  function move(from: number, to: number) {
    const now = current()
    if (from < 0 || to < 0 || to >= now.length || from === to) return
    commit(arrayMove(now, from, to), arrayMove(keys, from, to))
    const [toward, away] = to < from ? ["up", "down"] : ["down", "up"]
    const key = keys[from]
    focusLater(`${key}:${toward}`, `${key}:${away}`, `${key}:handle`)
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
  const help = field.meta.help

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={describedBy(id, { help, error })}
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
      {help ? (
        <p id={`${id}-help`} className="-mt-2 text-sm text-muted-foreground">
          {help}
        </p>
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
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          id={`${id}-add`}
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
          data-focus-key={`${sortId}:handle`}
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
