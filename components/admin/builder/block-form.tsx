"use client"

import { Info } from "lucide-react"
import { useMemo } from "react"
import type { z } from "zod"

import { FormCard } from "@/components/admin/form/form-ui"
import type {
  EditorMeta,
  FieldMeta,
} from "@/components/admin/schema-form/editor-meta"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import { unwrapSchema } from "@/components/admin/schema-form/resolve-widget"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { BLOCK_BY_TYPE, type BlockType } from "@/blocks/registry"

import { type DraftBlock, fieldLabel } from "./builder-state"

/** Per-block hints the field names cannot carry (meta keys as in EditorMeta). */
const BLOCK_FIELD_META: Partial<Record<BlockType, Record<string, FieldMeta>>> =
  {
    "hero.page": { image: { aspect: "video" } },
    stats: { items: { itemName: "Stat", itemLabel: "label" } },
    iconCards: {
      items: { itemName: "Card", itemLabel: "title" },
      "items[].icon": { aspect: "square" },
    },
    services: { count: { help: "Published services, in their list order." } },
    blog: { count: { help: "The latest published articles." } },
    departments: {
      items: { itemName: "Department", itemLabel: "title" },
      "items[].icon": { aspect: "square" },
      "items[].lines": { itemName: "Line", itemLabel: "text" },
    },
    // The capped rich text is not the shared schema object (resolve-widget
    // matches by identity), so the widget is named here.
    richtext: { doc: { widget: "richText" } },
  }

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] }

type AnySchema = z.ZodType
const typeOf = (schema: AnySchema) =>
  (schema as unknown as { def: { type: string } }).def.type

/** Labels for every field of a block schema (BLOCK_FIELD_LABELS), plus hints. */
export function blockEditorMeta(type: BlockType): EditorMeta {
  const fields: Record<string, FieldMeta> = {}
  const walk = (schema: AnySchema, path: string) => {
    const { inner } = unwrapSchema(schema)
    if (typeOf(inner) === "object") {
      const shape = (inner as z.ZodObject).shape as Record<string, AnySchema>
      for (const [key, child] of Object.entries(shape)) {
        const at = path ? `${path}.${key}` : key
        fields[at] = { label: fieldLabel(key) }
        walk(child, at)
      }
    } else if (typeOf(inner) === "array")
      walk((inner as z.ZodArray<AnySchema>).element, `${path}[]`)
  }
  walk(BLOCK_BY_TYPE[type].schema, "")
  // Shared-section blocks always use the shared copy (literal true, or the
  // About toggle): nothing to edit here.
  if (fields.useShared) fields.useShared = { ...fields.useShared, hidden: true }
  for (const [key, meta] of Object.entries(BLOCK_FIELD_META[type] ?? {}))
    fields[key] = { ...fields[key], ...meta }
  return { fields }
}

/** True when the block has no field of its own (it renders a shared section). */
export function isSharedOnly(type: BlockType): boolean {
  const shape = (BLOCK_BY_TYPE[type].schema as unknown as z.ZodObject).shape
  return Object.keys(shape).every((key) => key === "useShared")
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The form's starting value: the block's data over a blank of its schema. */
function formValue(block: DraftBlock): Record<string, unknown> {
  const blank = emptyValue(BLOCK_BY_TYPE[block.type].schema)
  const value = { ...(isRecord(blank) ? blank : {}), ...block.data }
  if (block.type === "richtext" && !isRecord(value.doc)) value.doc = EMPTY_DOC
  return value
}

/**
 * The selected block's content: SchemaForm over the block's schema, with
 * labels from BLOCK_FIELD_LABELS. Every change goes to `onChange` (valid or
 * not: autosave keeps drafts; publish runs the full check). `errors` are
 * the block's publish errors keyed by data path ("_root" for the block),
 * see blockErrors. Bump `resetKey` whenever the document is replaced
 * (restore, conflict reload, discard): the form then reloads `block.data`
 * instead of emitting its stale copy on the next keystroke.
 */
export function BlockForm({
  block,
  onChange,
  errors,
  readOnly,
  resetKey,
}: {
  block: DraftBlock
  onChange(data: unknown): void
  errors: Record<string, string[]>
  readOnly: boolean
  resetKey?: string | number
}) {
  const def = BLOCK_BY_TYPE[block.type]
  const meta = useMemo(() => blockEditorMeta(block.type), [block.type])
  if (isSharedOnly(block.type))
    return (
      <FormCard id={`block-${block.id}-shared`} title={def.label}>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {def.description} It shows the site-wide copy from Settings ›
            Sections, so it has nothing to fill in here.
          </span>
        </p>
        {errors._root?.length ? (
          <p className="text-sm text-destructive">{errors._root[0]}</p>
        ) : null}
      </FormCard>
    )
  // SchemaForm reads `value` once; keyed by block id, another block starts
  // a fresh form, and `resetKey` reloads this one after a replace.
  return (
    <SchemaForm
      key={block.id}
      resetKey={resetKey}
      schema={def.schema as unknown as z.ZodObject}
      meta={meta}
      value={formValue(block)}
      onChange={onChange}
      errors={errors}
      disabled={readOnly}
      idPrefix={`block-${block.id.slice(0, 8)}`}
    />
  )
}
