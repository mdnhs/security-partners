import type { z } from "zod"

import { link, mediaRef, paragraphsText, richText } from "@/lib/schemas/common"

import {
  type FieldMeta,
  humanize,
  type LeadingIcon,
  type WidgetKind,
} from "./editor-meta"

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

/**
 * True when some field the form shows must have a value (a non-optional
 * leaf; on/off switches never count). Objects and list items are searched.
 */
export function hasRequiredField(schema: z.ZodType): boolean {
  const { inner, optional, nullable } = unwrapSchema(schema)
  const def = defOf(inner) as Def & {
    shape?: Record<string, z.ZodType>
    element?: z.ZodType
  }
  if (def.type === "object")
    return Object.values(def.shape ?? {}).some(hasRequiredField)
  if (def.type === "array")
    return def.element ? hasRequiredField(def.element) : false
  if (def.type === "boolean") return false
  return !optional && !nullable
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

/** Text fields whose values are long lines: they take the full row. */
const WIDE_TEXT = new Set(["heading", "title", "tagline", "copyright", "tiles"])

/** Short controls share a row (two columns); the rest take the full row. */
const HALF_KINDS = new Set<WidgetKind>([
  "text",
  "number",
  "select",
  "toggle",
  "collection",
])

/** Column span of a field: meta.width, else by widget kind and name. */
export function defaultWidth(kind: WidgetKind, name: string): "half" | "full" {
  if (kind === "text" && WIDE_TEXT.has(name)) return "full"
  return HALF_KINDS.has(kind) ? "half" : "full"
}

/** Leading icon of a text input: meta.icon, else from its format or name. */
function leadingIcon(
  meta: FieldMeta,
  name: string,
  format: string | null
): LeadingIcon | null {
  if (meta.icon) return meta.icon
  if (format === "email" || /email$/i.test(name)) return "email"
  if (format === "url" || /(href|url)$/i.test(name)) return "url"
  if (/^phone|phone$|mobile$/i.test(name)) return "phone"
  return null
}

export type ResolvedField = {
  kind: WidgetKind
  /** Column span in the field grid. */
  width: "half" | "full"
  /** text only: icon inside the input, before the value. */
  icon: LeadingIcon | null
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
  const of = (
    kind: WidgetKind,
    extra: Partial<Pick<ResolvedField, "format" | "richTextMode">> = {}
  ): ResolvedField => {
    const format = extra.format ?? null
    return {
      ...base,
      ...extra,
      kind,
      width: meta.width ?? defaultWidth(kind, name),
      icon: kind === "text" ? leadingIcon(meta, name, format) : null,
    }
  }
  const format =
    defOf(inner).type === "string"
      ? ((inner as unknown as { format?: string | null }).format ?? null)
      : null
  if (meta.widget) return of(meta.widget, { format })
  if (inner === mediaRef) return of("media")
  if (inner === richText) return of("richText")
  if (inner === paragraphsText)
    return of("richText", { richTextMode: "paragraphs" })
  if (inner === link) return of("link")
  switch (defOf(inner).type) {
    case "object":
      return of("group")
    case "array":
      return of("list")
    case "boolean":
      return of("toggle")
    case "number":
      return of("number")
    case "enum":
      return of("select")
    case "string":
      return of(LONG_TEXT.has(name) ? "textarea" : "text", { format })
    default:
      throw new Error(
        `No widget for field "${path || "(root)"}" (${defOf(inner).type})`
      )
  }
}
