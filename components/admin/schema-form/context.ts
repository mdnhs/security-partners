"use client"

import { createContext, useContext } from "react"

import type { EditorMeta } from "./editor-meta"
import type { ResolvedField } from "./resolve-widget"

export type SchemaFormContextValue = {
  meta: EditorMeta
  disabled: boolean
  /** Prefix for element ids (two forms on one page stay unique). */
  idPrefix: string
}

export const SchemaFormContext = createContext<SchemaFormContextValue | null>(
  null
)

export function useSchemaForm(): SchemaFormContextValue {
  const value = useContext(SchemaFormContext)
  if (!value) throw new Error("Widgets must render inside <SchemaForm>")
  return value
}

/** Props every widget receives. `path` is the RHF field name ("hero.stats.0.value"). */
export type WidgetProps = { field: ResolvedField; path: string }

/** Stable DOM id for a field path. */
export function fieldId(idPrefix: string, path: string): string {
  return `${idPrefix}-${path.replaceAll(".", "-") || "root"}`
}
