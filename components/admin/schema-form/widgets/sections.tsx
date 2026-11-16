"use client"

import { ArrowDown, ArrowUp } from "lucide-react"
import { useController } from "react-hook-form"
import type { z } from "zod"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { normalizeSections } from "@/templates/shared/sections"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { enumValues } from "../resolve-widget"
import { describedBy, errorText, FieldShell } from "./field-shell"

/**
 * A fixed page's section layout: every section the page has, in order, each
 * with a show/hide switch and Move up / Move down. Sections cannot be added
 * or removed, only shown, hidden and reordered, so the list always holds
 * each one exactly once. A page saved before layouts existed reads as the
 * default order with everything shown; the first change writes the full list.
 */
export function SectionsWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const element = (field.schema as z.ZodArray<z.ZodObject>).element
  const ids = enumValues(element.shape.id as z.ZodType) ?? []
  const labels = new Map(
    (field.meta.options ?? []).map((o) => [o.value, o.label])
  )
  const items = normalizeSections(
    Array.isArray(value) ? (value as { id: string; visible: boolean }[]) : [],
    ids
  )
  const error = errorText(fieldState.error)
  const help = field.meta.help

  function commit(next: typeof items) {
    onChange(next)
  }
  function move(index: number, to: number) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(to, 0, item)
    commit(next)
  }
  function toggle(index: number, visible: boolean) {
    commit(items.map((item, i) => (i === index ? { ...item, visible } : item)))
  }

  return (
    <FieldShell id={id} label={field.label} help={help} error={error}>
      <ol
        aria-describedby={describedBy(id, { help, error })}
        className="flex flex-col gap-2"
      >
        <li className="flex min-h-12 items-center rounded-xl border border-dashed bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          Hero: always first
        </li>
        {items.map((item, index) => {
          const label = labels.get(item.id) ?? item.id
          return (
            <li
              key={item.id}
              data-visible={item.visible}
              className="flex min-h-12 items-center gap-3 rounded-xl border bg-background px-4 py-2 shadow-xs"
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm font-medium",
                  !item.visible && "text-muted-foreground line-through"
                )}
              >
                {label}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move ${label} up`}
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move ${label} down`}
                disabled={disabled || index === items.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Switch
                checked={item.visible}
                disabled={disabled}
                aria-label={`Show ${label}`}
                onCheckedChange={(checked) => toggle(index, checked)}
              />
            </li>
          )
        })}
      </ol>
    </FieldShell>
  )
}
