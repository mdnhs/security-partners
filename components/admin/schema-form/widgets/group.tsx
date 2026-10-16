"use client"

import { get, useFormState } from "react-hook-form"
import type { z } from "zod"

import {
  FIELD_GRID,
  FormCard,
  FormSubsection,
  FULL_SPAN,
} from "@/components/admin/form/form-ui"
import { cn } from "@/lib/utils"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { type EditorMeta, groupsFor, metaFor } from "../editor-meta"
import { Field } from "../field"
import { resolveWidget } from "../resolve-widget"
import { deepErrorText, ErrorText, errorText } from "./field-shell"

/**
 * Errors a group shows itself: one on the group path (e.g. a server message
 * for "hero") and ones on keys no child widget renders.
 */
function useGroupErrors(path: string, shape: Record<string, z.ZodType>) {
  const { errors } = useFormState({ name: path, disabled: !path })
  if (!path) return []
  const own = get(errors, path) as unknown
  if (!own || typeof own !== "object") return []
  const messages: string[] = []
  const self = errorText(own)
  if (self) messages.push(self)
  for (const [key, child] of Object.entries(own))
    if (!["message", "type", "ref", "root", "types"].includes(key))
      if (!Object.hasOwn(shape, key)) {
        const text = deepErrorText(child)
        if (text) messages.push(text)
      }
  return messages
}

function GroupErrors({ id, messages }: { id: string; messages: string[] }) {
  if (!messages.length) return null
  return (
    <div id={id} className="flex flex-col gap-1">
      {messages.map((message) => (
        <ErrorText key={message} id={`${id}-${message}`}>
          {message}
        </ErrorText>
      ))}
    </div>
  )
}

const childPath = (path: string, key: string) => (path ? `${path}.${key}` : key)

/**
 * Final spans for a run of fields: half-width fields pair up in order; one
 * left without a partner (next to a full-width field, or last) takes the
 * whole row, so no row ends with an empty column.
 */
export function pairHalves(widths: ("half" | "full")[]): ("half" | "full")[] {
  const out = [...widths]
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "half") continue
    if (out[i + 1] === "half") i++
    else out[i] = "full"
  }
  return out
}

/** Fields of one object in the two-column grid (meta.width / kind). */
function FieldGrid({
  shape,
  path,
  keys,
}: {
  shape: Record<string, z.ZodType>
  path: string
  keys: string[]
}) {
  const { meta } = useSchemaForm()
  const widths = pairHalves(
    keys.map(
      (key) =>
        resolveWidget(
          shape[key],
          metaFor(meta, childPath(path, key)),
          key,
          childPath(path, key)
        ).width
    )
  )
  return (
    <div className={FIELD_GRID}>
      {keys.map((key, i) => (
        <div
          key={key}
          data-width={widths[i]}
          className={cn("min-w-0", widths[i] === "full" && FULL_SPAN)}
        >
          <Field schema={shape[key]} name={key} path={childPath(path, key)} />
        </div>
      ))}
    </div>
  )
}

/** meta groups of `path` limited to `keys`, plus the keys no group lists. */
function splitGroups(meta: EditorMeta, path: string, keys: string[]) {
  const groups = groupsFor(meta, path)
  if (!groups) return null
  const listed = new Set(groups.flatMap((group) => group.fields))
  return {
    groups: groups
      .map((group) => ({
        ...group,
        fields: group.fields.filter((key) => keys.includes(key)),
      }))
      .filter((group) => group.fields.length > 0),
    rest: keys.filter((key) => !listed.has(key)),
  }
}

type Split = NonNullable<ReturnType<typeof splitGroups>>
type Block = { section: string } | { run: string[] }

/** Sections render their own card; runs of other fields share an untitled one. */
function blocksOf(
  shape: Record<string, z.ZodType>,
  keys: string[],
  split: Split | null,
  meta: EditorMeta
): Block[] {
  const blocks: Block[] = []
  for (const key of split ? split.rest : keys) {
    const field = resolveWidget(shape[key], metaFor(meta, key), key, key)
    if (field.kind === "group" && (field.meta.section ?? true))
      blocks.push({ section: key })
    else {
      const last = blocks.at(-1)
      if (last && "run" in last) last.run.push(key)
      else blocks.push({ run: [key] })
    }
  }
  return blocks
}

/** "Address & map" → "address-map". */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export type RootCardIds = { groups: string[]; blocks: string[] }

/** The cards of one root (or one root tab): meta groups, then sections and runs. */
export function rootCardPlan(
  meta: EditorMeta,
  shape: Record<string, z.ZodType>,
  keys: string[]
): { split: Split | null; blocks: Block[] } {
  const split = splitGroups(meta, "", keys)
  return { split, blocks: blocksOf(shape, keys, split, meta) }
}

/**
 * Stable, readable ids for the root cards: the group title as a slug (else
 * the first field key), made unique within the form ("-2", "-3" …). Form
 * tabs pass one `taken` set through every tab, so two tabs never share an
 * id either.
 */
export function groupCardIds(
  idPrefix: string,
  groups: { title: string; fields: string[] }[],
  blocks: Block[],
  taken: Set<string> = new Set()
): RootCardIds {
  const unique = (base: string) => {
    let id = `${idPrefix}-group-${base}`
    for (let n = 2; taken.has(id); n++) id = `${idPrefix}-group-${base}-${n}`
    taken.add(id)
    return id
  }
  return {
    groups: groups.map((group) => unique(slug(group.title) || group.fields[0])),
    blocks: blocks.map((block) => ("run" in block ? unique(block.run[0]) : "")),
  }
}

/**
 * The fields of the form root (or one root tab) as cards: one titled card
 * per meta group (editor-meta `groups[""]`), else sections render their own
 * card and the other fields share an untitled one.
 */
export function RootFields({
  shape,
  keys,
  ids: given,
}: {
  shape: Record<string, z.ZodType>
  keys: string[]
  /** Ids planned across every tab (FormTabs); alone, the root plans its own. */
  ids?: RootCardIds
}) {
  const { meta, idPrefix } = useSchemaForm()
  const { split, blocks } = rootCardPlan(meta, shape, keys)
  const ids = given ?? groupCardIds(idPrefix, split?.groups ?? [], blocks)
  return (
    <div className="flex flex-col gap-6">
      {split?.groups.map((group, i) => (
        <FormCard
          key={group.title}
          id={ids.groups[i]}
          title={group.title}
          description={group.description}
        >
          <FieldGrid shape={shape} path="" keys={group.fields} />
        </FormCard>
      ))}
      {blocks.map((block, i) =>
        "section" in block ? (
          <Field
            key={block.section}
            schema={shape[block.section]}
            name={block.section}
            path={block.section}
          />
        ) : (
          <FormCard key={block.run[0]} id={ids.blocks[i]}>
            <FieldGrid shape={shape} path="" keys={block.run} />
          </FormCard>
        )
      )}
    </div>
  )
}

/** Inside a section card: titled subsections per meta group, else a grid. */
function SectionFields({
  shape,
  path,
  id,
}: {
  shape: Record<string, z.ZodType>
  path: string
  id: string
}) {
  const { meta } = useSchemaForm()
  const keys = Object.keys(shape)
  const split = splitGroups(meta, path, keys)
  if (!split) return <FieldGrid shape={shape} path={path} keys={keys} />
  return (
    <>
      {split.groups.map((group, i) => (
        <FormSubsection
          key={group.title}
          id={`${id}-g${i}`}
          title={group.title}
          description={group.description}
        >
          <FieldGrid shape={shape} path={path} keys={group.fields} />
        </FormSubsection>
      ))}
      {split.rest.length ? (
        <FieldGrid shape={shape} path={path} keys={split.rest} />
      ) : null}
    </>
  )
}

export function GroupWidget({ field, path }: WidgetProps) {
  const { idPrefix } = useSchemaForm()
  const shape = (field.schema as z.ZodObject).shape as Record<string, z.ZodType>
  const groupErrors = useGroupErrors(path, shape)
  if (!path) return <RootFields shape={shape} keys={Object.keys(shape)} />
  const id = fieldId(idPrefix, path)
  const errorId = `${id}-error`
  const errors = <GroupErrors id={errorId} messages={groupErrors} />
  const errorRef = groupErrors.length ? errorId : undefined
  // A list item's object: the item card already titles it.
  if (/\.\d+$/.test(path))
    return (
      <div className="flex flex-col gap-4">
        {errors}
        <FieldGrid shape={shape} path={path} keys={Object.keys(shape)} />
      </div>
    )
  const section = field.meta.section ?? !path.includes(".")
  if (section)
    return (
      <FormCard
        id={id}
        title={field.label}
        description={field.meta.help}
        aria-describedby={errorRef}
      >
        {errors}
        <SectionFields shape={shape} path={path} id={id} />
      </FormCard>
    )
  return (
    <fieldset
      aria-describedby={errorRef}
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-muted/30 p-4"
    >
      <legend className="float-left mb-1 w-full text-sm font-semibold">
        {field.label}
      </legend>
      {field.meta.help ? (
        <p className="-mt-2 text-xs text-muted-foreground">{field.meta.help}</p>
      ) : null}
      {errors}
      <FieldGrid shape={shape} path={path} keys={Object.keys(shape)} />
    </fieldset>
  )
}
