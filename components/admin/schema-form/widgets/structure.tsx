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
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react"
import { type ReactNode, useId, useRef, useState } from "react"
import {
  get,
  useController,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form"
import type { z } from "zod"

import {
  FIELD_GRID,
  FormCard,
  FormSubsection,
  FULL_SPAN,
} from "@/components/admin/form/form-ui"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { type EditorMeta, groupsFor, metaFor } from "../editor-meta"
import { emptyValue } from "../empty-value"
import { toFormValues } from "../optional-values"
import { Field } from "../field"
import { arrayBounds, resolveWidget } from "../resolve-widget"
import {
  deepErrorText,
  describedBy,
  ErrorText,
  errorText,
  HelpText,
  LABEL_CLASS,
} from "./field-shell"

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
    <div id={id} className="flex flex-col gap-1">
      {messages.map((message) => (
        <ErrorText key={message} id={`${id}-${message}`}>
          {message}
        </ErrorText>
      ))}
    </div>
  )
}

const childPath = (path: string, key: string) => (path ? `${path}.${key}` : key)

/**
 * Final spans for a run of fields: half-width fields pair up in order; one
 * left without a partner (next to a full-width field, or last) takes the
 * whole row, so no row ends with an empty column.
 */
export function pairHalves(widths: ("half" | "full")[]): ("half" | "full")[] {
  const out = [...widths]
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "half") continue
    if (out[i + 1] === "half") i++
    else out[i] = "full"
  }
  return out
}

/** Fields of one object in the two-column grid (meta.width / kind). */
function FieldGrid({
  shape,
  path,
  keys,
}: {
  shape: Record<string, z.ZodType>
  path: string
  keys: string[]
}) {
  const { meta } = useSchemaForm()
  const widths = pairHalves(
    keys.map(
      (key) =>
        resolveWidget(
          shape[key],
          metaFor(meta, childPath(path, key)),
          key,
          childPath(path, key)
        ).width
    )
  )
  return (
    <div className={FIELD_GRID}>
      {keys.map((key, i) => (
        <div
          key={key}
          data-width={widths[i]}
          className={cn("min-w-0", widths[i] === "full" && FULL_SPAN)}
        >
          <Field schema={shape[key]} name={key} path={childPath(path, key)} />
        </div>
      ))}
    </div>
  )
}

/** meta groups of `path` limited to `keys`, plus the keys no group lists. */
function splitGroups(meta: EditorMeta, path: string, keys: string[]) {
  const groups = groupsFor(meta, path)
  if (!groups) return null
  const listed = new Set(groups.flatMap((group) => group.fields))
  return {
    groups: groups
      .map((group) => ({
        ...group,
        fields: group.fields.filter((key) => keys.includes(key)),
      }))
      .filter((group) => group.fields.length > 0),
    rest: keys.filter((key) => !listed.has(key)),
  }
}

/**
 * The fields of the form root (or one root tab) as cards: one titled card
 * per meta group (editor-meta `groups[""]`), else sections render their own
 * card and the other fields share an untitled one.
 */
export function RootFields({
  shape,
  keys,
}: {
  shape: Record<string, z.ZodType>
  keys: string[]
}) {
  const { meta, idPrefix } = useSchemaForm()
  const split = splitGroups(meta, "", keys)
  const id = `${idPrefix}-group`
  // Sections render their own card; runs of other fields share an untitled one.
  const blocks: ({ section: string } | { run: string[] })[] = []
  for (const key of split ? split.rest : keys) {
    const field = resolveWidget(shape[key], metaFor(meta, key), key, key)
    if (field.kind === "group" && (field.meta.section ?? true))
      blocks.push({ section: key })
    else {
      const last = blocks.at(-1)
      if (last && "run" in last) last.run.push(key)
      else blocks.push({ run: [key] })
    }
  }
  return (
    <div className="flex flex-col gap-6">
      {split?.groups.map((group, i) => (
        <FormCard
          key={group.title}
          id={`${id}-${i}`}
          title={group.title}
          description={group.description}
        >
          <FieldGrid shape={shape} path="" keys={group.fields} />
        </FormCard>
      ))}
      {blocks.map((block) =>
        "section" in block ? (
          <Field
            key={block.section}
            schema={shape[block.section]}
            name={block.section}
            path={block.section}
          />
        ) : (
          <FormCard key={block.run[0]} id={`${id}-${block.run[0]}`}>
            <FieldGrid shape={shape} path="" keys={block.run} />
          </FormCard>
        )
      )}
    </div>
  )
}

/** Inside a section card: titled subsections per meta group, else a grid. */
function SectionFields({
  shape,
  path,
  id,
}: {
  shape: Record<string, z.ZodType>
  path: string
  id: string
}) {
  const { meta } = useSchemaForm()
  const keys = Object.keys(shape)
  const split = splitGroups(meta, path, keys)
  if (!split) return <FieldGrid shape={shape} path={path} keys={keys} />
  return (
    <>
      {split.groups.map((group, i) => (
        <FormSubsection
          key={group.title}
          id={`${id}-g${i}`}
          title={group.title}
          description={group.description}
        >
          <FieldGrid shape={shape} path={path} keys={group.fields} />
        </FormSubsection>
      ))}
      {split.rest.length ? (
        <FieldGrid shape={shape} path={path} keys={split.rest} />
      ) : null}
    </>
  )
}

export function GroupWidget({ field, path }: WidgetProps) {
  const { idPrefix } = useSchemaForm()
  const shape = (field.schema as z.ZodObject).shape as Record<string, z.ZodType>
  const groupErrors = useGroupErrors(path, shape)
  if (!path) return <RootFields shape={shape} keys={Object.keys(shape)} />
  const id = fieldId(idPrefix, path)
  const errorId = `${id}-error`
  const errors = <GroupErrors id={errorId} messages={groupErrors} />
  const errorRef = groupErrors.length ? errorId : undefined
  // A list item's object: the item card already titles it.
  if (/\.\d+$/.test(path))
    return (
      <div className="flex flex-col gap-4">
        {errors}
        <FieldGrid shape={shape} path={path} keys={Object.keys(shape)} />
      </div>
    )
  const section = field.meta.section ?? !path.includes(".")
  if (section)
    return (
      <FormCard
        id={id}
        title={field.label}
        description={field.meta.help}
        aria-describedby={errorRef}
      >
        {errors}
        <SectionFields shape={shape} path={path} id={id} />
      </FormCard>
    )
  return (
    <fieldset
      aria-describedby={errorRef}
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-muted/30 p-4"
    >
      <legend className="float-left mb-1 w-full text-sm font-semibold">
        {field.label}
      </legend>
      {field.meta.help ? (
        <p className="-mt-2 text-xs text-muted-foreground">{field.meta.help}</p>
      ) : null}
      {errors}
      <FieldGrid shape={shape} path={path} keys={Object.keys(shape)} />
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
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span id={`${id}-label`} className={LABEL_CLASS}>
            {field.label}
          </span>
          {help ? <HelpText id={`${id}-help`}>{help}</HelpText> : null}
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No {itemName.toLowerCase()}s yet.
          {disabled ? null : ` Add the first one below.`}
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
      {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
      <div>
        <Button
          id={`${id}-add`}
          type="button"
          variant="outline"
          disabled={disabled || items.length >= max}
          onClick={add}
          className="h-11 w-full rounded-xl border-dashed border-input font-semibold text-primary hover:border-primary hover:bg-accent hover:text-accent-foreground"
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
  const value = useWatch({ name: path }) as unknown
  const position = `${itemName} ${index + 1}`
  const summary = itemSummary(value, itemLabel)
  const { errors } = useFormState({ name: path })
  const hasError = get(errors, path) !== undefined
  const [collapsed, setCollapsed] = useState(false)
  const collapsible =
    typeof value === "object" && value !== null && !Array.isArray(value)
  const open = !collapsible || !collapsed || hasError
  const bodyId = `${sortId}-${path}-body`
  const iconButton =
    "size-9 rounded-lg pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-4"
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex flex-col rounded-xl border bg-background shadow-xs",
        isDragging && "z-10 shadow-lg"
      )}
      aria-label={position}
    >
      <div className="flex items-center gap-1 p-1.5 pl-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          data-focus-key={`${sortId}:handle`}
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${position}`}
          className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground tabular-nums"
        >
          {index + 1}
        </span>
        <ItemTitle
          collapsible={collapsible}
          open={open}
          bodyId={bodyId}
          onToggle={() => setCollapsed((c) => !c)}
        >
          <span className="shrink-0 text-sm font-semibold">{position}</span>
          {summary ? (
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </ItemTitle>
        <Button
          type="button"
          variant="ghost"
          className={iconButton}
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
          className={iconButton}
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
          aria-label={`Remove ${position}`}
          disabled={!canRemove}
          onClick={onRemove}
          className={cn(iconButton, "text-destructive hover:text-destructive")}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div
        id={bodyId}
        hidden={!open}
        data-focus-key={`${sortId}:first`}
        tabIndex={-1}
        className={cn(
          "flex-col gap-4 border-t px-4 pt-4 pb-5 outline-none",
          open ? "flex" : "hidden"
        )}
      >
        <Field schema={element} name={position} path={path} />
      </div>
    </li>
  )
}

/**
 * The item's name and summary; for object items a disclosure button that
 * collapses the item (its fields stay mounted, hidden).
 */
function ItemTitle({
  collapsible,
  open,
  bodyId,
  onToggle,
  children,
}: {
  collapsible: boolean
  open: boolean
  bodyId: string
  onToggle: () => void
  children: ReactNode
}) {
  const className =
    "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left"
  if (!collapsible) return <span className={className}>{children}</span>
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={bodyId}
      onClick={onToggle}
      className={cn(
        className,
        "outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
    >
      {children}
      <ChevronDown
        aria-hidden
        className={cn(
          "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
          !open && "-rotate-90"
        )}
      />
    </button>
  )
}

/**
 * One line naming an item: its first two texts in field order ("18+ ·
 * Years in business"), always including the itemLabel field's value.
 */
export function itemSummary(value: unknown, itemLabel?: string): string {
  if (typeof value === "string") return ""
  if (typeof value !== "object" || value === null) return ""
  const record = value as Record<string, unknown>
  const texts = (keys: string[]) =>
    keys
      .map((key) => record[key])
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
  const parts = texts(Object.keys(record)).slice(0, 2)
  // The item's naming field always shows, even when it is not among the first two.
  const [named] = itemLabel ? texts([itemLabel]) : []
  if (named && !parts.includes(named)) parts.splice(1, 1, named)
  return parts.join(" · ")
}
