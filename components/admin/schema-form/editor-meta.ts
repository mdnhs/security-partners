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
  /**
   * Not shown in the form: the value is kept as stored (schema-compatible)
   * but the field has no editor, e.g. a setting the site does not use.
   */
  hidden?: boolean
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
  /** list: plural of itemName where adding "s" is wrong ("Qualities"). */
  itemNamePlural?: string
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
  /**
   * Column span in a two-column field grid (from 36rem of card width).
   * Default: half for short inputs (text, number, select, toggle,
   * collection), full for everything else (see defaultWidth).
   */
  width?: "half" | "full"
  /** text: a leading icon (default: from the format or the field name). */
  icon?: LeadingIcon
  /** media: thumbnail shape (default "video"). */
  aspect?: "video" | "square"
}

/** Leading icons a text input can show. */
export type LeadingIcon = "phone" | "email" | "url" | "clock" | "map"

/**
 * Fields of one object shown as titled cards (at the form root) or titled
 * subsections (inside a section card). Keys not listed in any group follow
 * in an untitled card, so a field is never lost.
 */
export type FieldGroupMeta = {
  title: string
  description?: string
  /** Child keys of the object, in display order. */
  fields: string[]
}

/**
 * Field hints keyed by path, with [] for list items:
 * "hero.heading", "hero.stats[].value", "highlights[]".
 */
export type EditorMeta = {
  fields: Record<string, FieldMeta>
  /** Groups per object path (meta key; "" is the form root, "hero" a section). */
  groups?: Record<string, FieldGroupMeta[]>
}

export const EMPTY_META: EditorMeta = { fields: {} }

/** "hero.stats.2.value" → "hero.stats[].value" (meta lookup key). */
export function metaKey(path: string): string {
  return path.replace(/\.\d+(?=\.|$)/g, "[]")
}

export function metaFor(meta: EditorMeta, path: string): FieldMeta {
  return meta.fields[metaKey(path)] ?? {}
}

export function groupsFor(
  meta: EditorMeta,
  path: string
): FieldGroupMeta[] | undefined {
  return meta.groups?.[metaKey(path)]
}

/** "phone24hLabel" → "Phone24h label", "primaryCta" → "Primary cta". */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
