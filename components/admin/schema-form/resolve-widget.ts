import type { z } from "zod"

import { link, mediaRef, paragraphsText, richText } from "@/lib/schemas/common"

import { type FieldMeta, humanize, type WidgetKind } from "./editor-meta"

type Def = {
  type: string
  innerType?: z.ZodType
  checks?: {
    _zod: { def: { check: string; minimum?: number; maximum?: number } }
  }[]
}
const defOf = (schema: z.ZodType) => (schema as unknown as { def: Def }).def

/** Strips optional / nullable / default wrappers and remembers them. */
export function unwrapSchema(schema: z.ZodType): {
  inner: z.ZodType
  optional: boolean
  nullable: boolean
} {
  let inner = schema
  let optional = false
  let nullable = false
  for (;;) {
    const def = defOf(inner)
    if (def.type === "optional" || def.type === "default") optional = true
    else if (def.type === "nullable") nullable = true
    else break
    inner = def.innerType!
  }
  return { inner, optional, nullable }
}

/** min/max item counts of a z.array (`.min(1)` etc.). */
export function arrayBounds(schema: z.ZodType): { min: number; max: number } {
  let min = 0
  let max = Number.POSITIVE_INFINITY
  for (const check of defOf(schema).checks ?? []) {
    const c = check._zod.def
    if (c.check === "min_length" && c.minimum !== undefined) min = c.minimum
    if (c.check === "max_length" && c.maximum !== undefined) max = c.maximum
  }
  return { min, max }
}

/** Long copy gets a textarea unless meta says otherwise. */
const LONG_TEXT = new Set([
  "description",
  "subheading",
  "intro",
  "copy",
  "bio",
  "body",
  "excerpt",
  "caption",
  "callout",
  "headHtml",
  "bodyEndHtml",
])

export type ResolvedField = {
  kind: WidgetKind
  /** The unwrapped schema the widget edits. */
  schema: z.ZodType
  optional: boolean
  nullable: boolean
  label: string
  meta: FieldMeta
  /** "email" | "url" for formatted strings (input type). */
  format: string | null
  /** richText only. */
  richTextMode: "full" | "paragraphs"
}

/**
 * Picks the widget for one field: meta.widget first, then the shared
 * schemas by identity (media, rich text, link), then the Zod type.
 * Throws for a schema no widget can edit (caught by the "every template
 * renders" test, never at runtime for shipped schemas).
 */
export function resolveWidget(
  schema: z.ZodType,
  meta: FieldMeta,
  name: string,
  path: string
): ResolvedField {
  const { inner, optional, nullable } = unwrapSchema(schema)
  const base = {
    schema: inner,
    optional,
    nullable,
    meta,
    label: meta.label ?? humanize(name),
    format: null as string | null,
    richTextMode: "full" as "full" | "paragraphs",
  }
  if (meta.widget) return { ...base, kind: meta.widget }
  if (inner === mediaRef) return { ...base, kind: "media" }
  if (inner === richText) return { ...base, kind: "richText" }
  if (inner === paragraphsText)
    return { ...base, kind: "richText", richTextMode: "paragraphs" }
  if (inner === link) return { ...base, kind: "link" }
  switch (defOf(inner).type) {
    case "object":
      return { ...base, kind: "group" }
    case "array":
      return { ...base, kind: "list" }
    case "boolean":
      return { ...base, kind: "toggle" }
    case "number":
      return { ...base, kind: "number" }
    case "enum":
      return { ...base, kind: "select" }
    case "string": {
      const format =
        (inner as unknown as { format?: string | null }).format ?? null
      const kind = LONG_TEXT.has(name) ? "textarea" : "text"
      return { ...base, kind, format }
    }
    default:
      throw new Error(
        `No widget for field "${path || "(root)"}" (${defOf(inner).type})`
      )
  }
}
