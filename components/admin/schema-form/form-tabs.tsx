"use client"

import { useEffect, useMemo, useRef } from "react"
import { type FieldErrors, useFormState } from "react-hook-form"
import type { z } from "zod"

import {
  SectionTabs,
  SectionTabsPanel,
  useTabParam,
} from "@/components/admin/section-tabs/section-tabs"

import { type EditorMeta, metaFor } from "./editor-meta"
import { Field } from "./field"
import { resolveWidget } from "./resolve-widget"

export type FormTab = { id: string; label: string; keys: string[] }

/**
 * Top-level tabs for a schema: one per object group ("hero", "blog"); the
 * other top-level fields share one tab where the first of them appears
 * (named after the field when it is alone, else "General").
 */
export function formTabs(schema: z.ZodObject, meta: EditorMeta): FormTab[] {
  const tabs: FormTab[] = []
  let general: FormTab | null = null
  for (const [key, child] of Object.entries(schema.shape)) {
    const field = resolveWidget(
      child as z.ZodType,
      metaFor(meta, key),
      key,
      key
    )
    if (field.kind === "group") {
      tabs.push({ id: key, label: field.label, keys: [key] })
      continue
    }
    if (!general) {
      general = { id: key, label: field.label, keys: [] }
      tabs.push(general)
    }
    general.keys.push(key)
  }
  if (general && general.keys.length > 1) {
    general.id = "general"
    general.label = "General"
  }
  return tabs
}

/** Top-level key of an error path ("hero.stats.0.value" → "hero"). */
const topKey = (path: string) => path.split(".")[0]

/**
 * The form's top-level groups as section tabs. Every group stays mounted
 * (hidden panels), so react-hook-form keeps values, registration and
 * validation of the tabs not shown; tabs with errors are marked, and a new
 * set of errors (failed publish, 422) opens the first tab that has one.
 */
export function FormTabs({
  tabs,
  schema,
  ariaLabel,
  errors,
}: {
  tabs: FormTab[]
  schema: z.ZodObject
  ariaLabel: string
  /** Errors passed to SchemaForm (server / publish check). */
  errors?: Record<string, string[]>
}) {
  const [fromUrl, select] = useTabParam()
  const selected = tabs.some((tab) => tab.id === fromUrl)
    ? fromUrl!
    : tabs[0].id
  const selectedRef = useRef(selected)
  useEffect(() => {
    selectedRef.current = selected
  })

  useEffect(() => {
    const keys = new Set(
      Object.entries(errors ?? {})
        .filter(([path, messages]) => path !== "_root" && messages[0])
        .map(([path]) => topKey(path))
    )
    if (keys.size === 0) return
    const current = tabs.find((tab) => tab.id === selectedRef.current)
    if (current?.keys.some((key) => keys.has(key))) return
    const first = tabs.find((tab) => tab.keys.some((key) => keys.has(key)))
    if (first) select(first.id)
  }, [errors, tabs, select])

  const { errors: formErrors } = useFormState()
  const items = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    error: hasErrors(formErrors, tab.keys),
  }))

  // Panels only depend on the schema: switching tabs or a new error must not
  // re-render every widget.
  const panels = useMemo(
    () =>
      tabs.map((tab) => (
        <SectionTabsPanel key={tab.id} id={tab.id}>
          <div className="flex flex-col gap-6">
            {tab.keys.map((key) => (
              <Field
                key={key}
                schema={schema.shape[key] as z.ZodType}
                name={key}
                path={key}
              />
            ))}
          </div>
        </SectionTabsPanel>
      )),
    [tabs, schema]
  )
  return (
    <SectionTabs
      ariaLabel={ariaLabel}
      items={items}
      value={selected}
      onValueChange={select}
    >
      {panels}
    </SectionTabs>
  )
}

function hasErrors(errors: FieldErrors, keys: string[]): boolean {
  return keys.some((key) => errors[key] !== undefined)
}
