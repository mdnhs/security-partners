import type { OptionCollection } from "@/lib/schemas/api/search"

/** Widget kinds SchemaForm renders (master 4.3). */
export const WIDGET_KINDS = [
  "text",
  "textarea",
  "richText",
  "link",
  "media",
  "number",
  "toggle",
  "select",
  "list",
  "group",
  "collection",
] as const
export type WidgetKind = (typeof WIDGET_KINDS)[number]

/** Editor hints for one field; everything is optional (defaults come from the schema). */
export type FieldMeta = {
  label?: string
  help?: string
  placeholder?: string
  /** Force a widget (e.g. "collection" for a slug that picks an article). */
  widget?: WidgetKind
  /** textarea rows (default 3). */
  rows?: number
  /** Counter maximum shown under a textarea (default: the schema's max). */
  maxLength?: number
  /** select: labels for enum values. */
  options?: { value: string; label: string }[]
  /** collection: where the choices come from. */
  collection?: OptionCollection
  /** list: singular noun for one item ("Stat" → "Add stat", "Stat 2"). */
  itemName?: string
  /** list of objects: field whose value titles each item card. */
  itemLabel?: string
  /** group: render as a titled card (default for top-level groups). */
  section?: boolean
  /**
   * text: sibling keys this value is built from. While the first sibling
   * holds a value the field is read-only and kept equal to the siblings
   * joined ("count" 18 + "suffix" "+" → "18+").
   */
  composeFrom?: string[]
}

/**
 * Field hints keyed by path, with [] for list items:
 * "hero.heading", "hero.stats[].value", "highlights[]".
 */
export type EditorMeta = { fields: Record<string, FieldMeta> }

export const EMPTY_META: EditorMeta = { fields: {} }

/** "hero.stats.2.value" → "hero.stats[].value" (meta lookup key). */
export function metaKey(path: string): string {
  return path.replace(/\.\d+(?=\.|$)/g, "[]")
}

export function metaFor(meta: EditorMeta, path: string): FieldMeta {
  return meta.fields[metaKey(path)] ?? {}
}

/** "phone24hLabel" → "Phone24h label", "primaryCta" → "Primary cta". */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
