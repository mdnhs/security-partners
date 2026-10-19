import { z } from "zod"

import { collectMediaFields } from "@/lib/media"

import {
  Anchor,
  BLOCK_BY_TYPE,
  BLOCK_TYPES,
  BlockId,
  BlockInstance,
  type BlockType,
  reservedAnchorProblem,
} from "./registry"

/** Deeper than any block shape (a linked word in a rich-text list is 13). */
const MAX_DRAFT_DEPTH = 16

/** Iterative, so hostile nesting cannot overflow the stack. */
function nestedWithin(value: unknown, max: number): boolean {
  const stack: [unknown, number][] = [[value, 1]]
  while (stack.length > 0) {
    const [node, depth] = stack.pop()!
    if (!node || typeof node !== "object") continue
    if (depth > max) return false
    for (const child of Object.values(node)) stack.push([child, depth + 1])
  }
  return true
}

const mediaId = z.uuid()

/** Draft block data: any record, but bounded depth and real media ids. */
const draftData = z.record(z.string(), z.unknown()).superRefine((data, ctx) => {
  if (!nestedWithin(data, MAX_DRAFT_DEPTH)) {
    ctx.addIssue({
      code: "custom",
      message: "This block's data is too deeply nested",
    })
    return
  }
  for (const { mediaId: id, field } of collectMediaFields(data))
    if (!mediaId.safeParse(id).success)
      ctx.addIssue({
        code: "custom",
        message: "Choose an image from the media library",
        path: [
          ...field.split(".").map((k) => (/^\d+$/.test(k) ? Number(k) : k)),
          "mediaId",
        ],
      })
})

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
      z
        .object({
          id: BlockId,
          type: z.enum(BLOCK_TYPES),
          anchor: z.string().max(40),
          hidden: z.boolean(),
          data: draftData,
        })
        // Reserved section ids hold for drafts too: save, restore and a
        // copied page's seed are refused like publish (D5.5 ruling).
        .superRefine((block, ctx) => {
          const problem = reservedAnchorProblem(block.anchor, block.type)
          if (problem)
            ctx.addIssue({ code: "custom", message: problem, path: ["anchor"] })
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
 * Rules no single block can check: unique ids and anchors, reserved
 * section anchors, "first" blocks at index 0 and "max" per type. They run on the raw input too, so an
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
    // Only well-formed anchors are compared (and echoed back): a malformed
    // one already has its format error, and may be arbitrarily long.
    if (typeof anchor === "string" && Anchor.safeParse(anchor).success) {
      if (anchors.has(anchor))
        add(
          `blocks.${i}.anchor`,
          `Anchor "${anchor}" is already used on this page`
        )
      anchors.add(anchor)
    }
    const type = field(block, "type")
    if (!isBlockType(type)) return
    if (typeof anchor === "string" && Anchor.safeParse(anchor).success) {
      const reserved = reservedAnchorProblem(anchor, type)
      if (reserved) add(`blocks.${i}.anchor`, reserved)
    }
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

/**
 * A fresh BlockId. crypto.randomUUID() exists only in secure contexts, so
 * an admin opened over plain http (LAN, staging IP) falls back to 16
 * random bytes as hex (getRandomValues is available everywhere).
 */
function newBlockId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

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
    id: newBlockId(),
    type,
    anchor,
    hidden: false,
    data: structuredClone(BLOCK_BY_TYPE[type].defaults),
  } as BlockInstance
}
