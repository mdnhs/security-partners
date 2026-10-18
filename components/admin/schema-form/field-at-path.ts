import type { z } from "zod"

import { type EditorMeta, metaFor } from "./editor-meta"
import {
  type ResolvedField,
  resolveWidget,
  unwrapSchema,
} from "./resolve-widget"

type Def = {
  type: string
  checks?: { _zod: { def: { check: string; maximum?: number } } }[]
}
const defOf = (schema: z.ZodType) => (schema as unknown as { def: Def }).def

/**
 * The field at a react-hook-form path ("hero.stats.0.value"), resolved the
 * way SchemaForm renders it; null when the path is not in the schema.
 * List items are named "<list> <n>" ("highlights.1" → "Highlights 2").
 */
export function fieldAtPath(
  root: z.ZodType,
  meta: EditorMeta,
  path: string
): ResolvedField | null {
  if (!path) return null
  let node: z.ZodType = root
  let name = ""
  for (const part of path.split(".")) {
    const { inner } = unwrapSchema(node)
    const type = defOf(inner).type
    if (type === "object") {
      const shape = (inner as z.ZodObject).shape as Record<string, z.ZodType>
      if (!Object.hasOwn(shape, part)) return null
      node = shape[part]
      name = part
    } else if (type === "array" && /^\d+$/.test(part)) {
      node = (inner as z.ZodArray<z.ZodType>).element
      name = `${name} ${Number(part) + 1}`
    } else return null
  }
  try {
    return resolveWidget(node, metaFor(meta, path), name, path)
  } catch {
    return null
  }
}

/** A string schema's `.max()`, or null. */
export function stringMaxLength(schema: z.ZodType): number | null {
  for (const check of defOf(schema).checks ?? []) {
    const c = check._zod.def
    if (c.check === "max_length" && c.maximum !== undefined) return c.maximum
  }
  return null
}

/**
 * Fields the AI assistant can fill ("Insert"): plain text inputs and
 * textareas holding a string, except values composed from their siblings
 * (read-only in the form).
 */
export function insertableTextField(
  root: z.ZodType,
  meta: EditorMeta,
  path: string
): ResolvedField | null {
  const field = fieldAtPath(root, meta, path)
  if (!field || (field.kind !== "text" && field.kind !== "textarea"))
    return null
  if (field.meta.composeFrom?.length) return null
  if (defOf(field.schema).type !== "string") return null
  return field
}
