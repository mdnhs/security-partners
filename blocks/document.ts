import { z } from "zod"

import {
  BLOCK_BY_TYPE,
  BLOCK_TYPES,
  BlockId,
  BlockInstance,
  type BlockType,
} from "./registry"

/** A builder page's published content. */
export const BuilderDocument = z.object({
  blocks: z.array(BlockInstance).min(1).max(40),
})
export type BuilderDocument = z.infer<typeof BuilderDocument>

/**
 * The working copy autosave writes: known block types with any data object,
 * so half-finished edits save. Publish runs validateDocument.
 */
export const DraftDocument = z.object({
  blocks: z
    .array(
      z.object({
        id: BlockId,
        type: z.enum(BLOCK_TYPES),
        anchor: z.string().max(40),
        hidden: z.boolean(),
        data: z.record(z.string(), z.unknown()),
      })
    )
    .max(40),
})
export type DraftDocument = z.infer<typeof DraftDocument>

export type ValidateResult =
  | { ok: true; doc: BuilderDocument }
  | { ok: false; fieldErrors: Record<string, string[]> }

const field = (value: unknown, key: string): unknown =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined

const isBlockType = (value: unknown): value is BlockType =>
  typeof value === "string" && Object.hasOwn(BLOCK_BY_TYPE, value)

/**
 * Rules no single block can check: unique ids and anchors, "first" blocks
 * at index 0 and "max" per type. They run on the raw input too, so an
 * editor sees placement errors alongside unfinished fields.
 */
function documentRules(
  blocks: unknown[],
  add: (key: string, m: string) => void
) {
  const ids = new Set<string>()
  const anchors = new Set<string>()
  const counts = new Map<BlockType, number>()
  blocks.forEach((block, i) => {
    const id = field(block, "id")
    if (typeof id === "string") {
      if (ids.has(id)) add(`blocks.${i}.id`, "Two blocks share this id")
      ids.add(id)
    }
    const anchor = field(block, "anchor")
    if (typeof anchor === "string") {
      if (anchors.has(anchor))
        add(
          `blocks.${i}.anchor`,
          `Anchor "${anchor}" is already used on this page`
        )
      anchors.add(anchor)
    }
    const type = field(block, "type")
    if (!isBlockType(type)) return
    const def = BLOCK_BY_TYPE[type]
    if ("first" in def && def.first && i !== 0)
      add(`blocks.${i}.type`, `${def.label} must be the first block`)
    const n = (counts.get(type) ?? 0) + 1
    counts.set(type, n)
    if ("max" in def && def.max !== undefined && n > def.max)
      add(`blocks.${i}.type`, `At most ${def.max} ${def.label} per page`)
  })
}

/** Full publish check; errors keyed "blocks.<i>.<path>" for the editor. */
export function validateDocument(doc: unknown): ValidateResult {
  const fieldErrors: Record<string, string[]> = {}
  const add = (key: string, message: string) => {
    const list = (fieldErrors[key] ??= [])
    if (!list.includes(message)) list.push(message)
  }
  const parsed = BuilderDocument.safeParse(doc)
  if (!parsed.success)
    for (const issue of parsed.error.issues)
      add(issue.path.map(String).join(".") || "document", issue.message)
  const blocks = field(doc, "blocks")
  if (Array.isArray(blocks)) documentRules(blocks, add)
  if (parsed.success && Object.keys(fieldErrors).length === 0)
    return { ok: true, doc: parsed.data }
  return { ok: false, fieldErrors }
}

/** "hero.page" → "hero-page", "whyChooseUs" → "why-choose-us". */
const anchorBase = (type: BlockType) =>
  type
    .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    .replace(/[^a-z0-9]+/g, "-")

/** A new block of `type` with a fresh id, an unused anchor and its defaults. */
export function emptyBlock(
  type: BlockType,
  existing: BuilderDocument | { blocks: { anchor: string }[] }
): BlockInstance {
  const taken = new Set(existing.blocks.map((block) => block.anchor))
  const base = anchorBase(type)
  let anchor = base
  for (let n = 2; taken.has(anchor); n++) anchor = `${base}-${n}`
  return {
    id: crypto.randomUUID(),
    type,
    anchor,
    hidden: false,
    data: structuredClone(BLOCK_BY_TYPE[type].defaults),
  } as BlockInstance
}
