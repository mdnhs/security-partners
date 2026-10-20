"use client"

import { useEffect, useMemo, useRef } from "react"
import { type FieldErrors, useFormContext, useFormState } from "react-hook-form"
import type { z } from "zod"

import {
  SectionTabs,
  SectionTabsPanel,
  useTabParam,
} from "@/components/admin/section-tabs/section-tabs"

import { useSchemaForm } from "./context"
import { type EditorMeta, metaFor } from "./editor-meta"
import { resolveWidget } from "./resolve-widget"
import { groupCardIds, rootCardPlan, RootFields } from "./widgets/group"

export type FormTab = { id: string; label: string; keys: string[] }

/**
 * Top-level tabs for a schema: one per object group ("hero", "blog"); the
 * other top-level fields share one tab where the first of them appears
 * (named after the field when it is alone, else "General"; its id never
 * reuses a group's key, so a group named "general" keeps its own tab).
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
    const taken = new Set(tabs.map((tab) => tab.id))
    let id = "general"
    for (let n = 2; taken.has(id); n++) id = `general-${n}`
    general.id = id
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
 * set of errors (failed publish, 422) opens the first tab that has one
 * (replacing the history entry) and focuses its first invalid field.
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

  // After an error jump, focus the first invalid field once its panel shows.
  const { setFocus } = useFormContext()
  const rootRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<{ tab: string; path: string } | null>(null)
  useEffect(() => {
    const pending = pendingFocus.current
    if (!pending || pending.tab !== selected) return
    pendingFocus.current = null
    setFocus(pending.path)
    const panel = rootRef.current?.querySelector<HTMLElement>(
      `[data-form-tab="${CSS.escape(pending.tab)}"]`
    )
    if (!panel || panel.contains(document.activeElement)) return
    // setFocus does nothing for a path no input registers (a list's own
    // error, a media picker): focus the first invalid control instead, or
    // the first control of the group whose error shows.
    const invalid = panel.querySelector<HTMLElement>('[aria-invalid="true"]')
    const message = panel.querySelector('[data-slot="field-error"]')
    const control = message
      ?.closest('[role="group"], fieldset, section')
      ?.querySelector<HTMLElement>("input, textarea, select, button")
    ;(invalid ?? control)?.focus()
  })

  useEffect(() => {
    const paths = Object.entries(errors ?? {})
      .filter(([path, messages]) => path !== "_root" && messages[0])
      .map(([path]) => path)
    const keys = new Set(paths.map(topKey))
    if (keys.size === 0) return
    // Already on the errored tab, unless ?tab= names something else (an
    // editor's SEO tab): then the tab is shown and the URL says so.
    const url = new URLSearchParams(window.location.search).get("tab")
    const onOwnTab = url === null || tabs.some((tab) => tab.id === url)
    const current = tabs.find((tab) => tab.id === selectedRef.current)
    if (onOwnTab && current?.keys.some((key) => keys.has(key))) return
    const first = tabs.find((tab) => tab.keys.some((key) => keys.has(key)))
    if (!first) return
    // First invalid field in the tab's field order.
    const path = first.keys
      .map((key) => paths.find((p) => topKey(p) === key))
      .find((p) => p !== undefined)!
    pendingFocus.current = { tab: first.id, path }
    select(first.id, { replace: true })
  }, [errors, tabs, select])

  const { errors: formErrors } = useFormState()
  const items = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    error: hasErrors(formErrors, tab.keys),
  }))

  // Panels only depend on the schema (and meta): switching tabs or a new
  // error must not re-render every widget. Card ids are planned here, over
  // one `taken` set, so no two tabs share one.
  const { meta, idPrefix } = useSchemaForm()
  const panels = useMemo(() => {
    const shape = schema.shape as Record<string, z.ZodType>
    const taken = new Set<string>()
    return tabs.map((tab) => {
      const { split, blocks } = rootCardPlan(meta, shape, tab.keys)
      const ids = groupCardIds(idPrefix, split?.groups ?? [], blocks, taken)
      return (
        <SectionTabsPanel key={tab.id} id={tab.id}>
          <div data-form-tab={tab.id}>
            <RootFields shape={shape} keys={tab.keys} ids={ids} />
          </div>
        </SectionTabsPanel>
      )
    })
  }, [tabs, schema, meta, idPrefix])
  return (
    <div ref={rootRef} className="contents">
      <SectionTabs
        ariaLabel={ariaLabel}
        items={items}
        value={selected}
        onValueChange={select}
      >
        {panels}
      </SectionTabs>
    </div>
  )
}

function hasErrors(errors: FieldErrors, keys: string[]): boolean {
  return keys.some((key) => errors[key] !== undefined)
}
