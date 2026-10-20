import { DraftDocument, emptyBlock } from "@/blocks/document"
import {
  Anchor,
  BLOCK_BY_TYPE,
  BLOCKS,
  type BlockType,
  RESERVED_ANCHORS,
  reservedAnchorProblem,
} from "@/blocks/registry"

// The page builder's working copy (spec §7.5): a pure reducer over the
// draft document plus the rules the UI enforces before the server does
// (placement, reserved anchors) and the mapping of publish errors
// ("blocks.<i>.<path>", blocks/document.ts) onto blocks.

export type DraftDocumentValue = DraftDocument
export type DraftBlock = DraftDocumentValue["blocks"][number]
export type BlockMetaPatch = { anchor?: string; hidden?: boolean }

export type DocAction =
  | { type: "add"; blockType: BlockType; at: number }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; to: number }
  | { type: "duplicate"; id: string }
  | { type: "data"; id: string; data: unknown }
  | { type: "meta"; id: string; patch: BlockMetaPatch }
  | { type: "replace"; doc: DraftDocumentValue }

/** BuilderDocument / DraftDocument hold at most this many blocks. */
export const MAX_BLOCKS = 40

/** Shared with validateDocument / DraftDocument (blocks/registry.ts). */
export { RESERVED_ANCHORS }

const isFirstType = (type: BlockType) => {
  const def = BLOCK_BY_TYPE[type]
  return "first" in def && def.first === true
}
const maxOf = (type: BlockType): number | undefined => {
  const def = BLOCK_BY_TYPE[type]
  return "max" in def ? def.max : undefined
}

/** Blocks of types placed first (the page hero) stay at index 0. */
export function firstMovable(doc: DraftDocumentValue): number {
  const head = doc.blocks[0]
  return head && isFirstType(head.type) ? 1 : 0
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max)

/** Types the library may add: under their per-page max and the 40-block cap. */
export function addableTypes(doc: DraftDocumentValue): BlockType[] {
  if (doc.blocks.length >= MAX_BLOCKS) return []
  return BLOCKS.filter((def) => {
    const max = maxOf(def.type)
    const count = doc.blocks.filter((b) => b.type === def.type).length
    if (max !== undefined && count >= max) return false
    if (isFirstType(def.type) && doc.blocks.some((b) => isFirstType(b.type)))
      return false
    return true
  }).map((def) => def.type)
}

/** Why the library cannot add `type` here (text shown next to it). */
export function unavailableReason(
  type: BlockType,
  doc?: DraftDocumentValue
): string {
  if (doc && doc.blocks.length >= MAX_BLOCKS)
    return `A page holds at most ${MAX_BLOCKS} blocks`
  const max = maxOf(type)
  if (max === 1 || isFirstType(type)) return "Only one per page"
  if (max !== undefined) return `At most ${max} per page`
  return `A page holds at most ${MAX_BLOCKS} blocks`
}

const anchorFormatError = (anchor: string): string | null => {
  const parsed = Anchor.safeParse(anchor)
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Invalid")
}

/**
 * The problem with giving `block` this anchor, or null: format (Anchor),
 * a section id reserved for another block type, or one used on the page.
 */
export function anchorProblem(
  anchor: string,
  block: Pick<DraftBlock, "id" | "type">,
  doc: DraftDocumentValue
): string | null {
  const format = anchorFormatError(anchor)
  if (format) return format
  const reserved = reservedAnchorProblem(anchor, block.type)
  if (reserved) return reserved
  if (doc.blocks.some((b) => b.id !== block.id && b.anchor === anchor))
    return `Anchor "${anchor}" is already used on this page`
  return null
}

/** `base-2`, `base-3` … : the first free, allowed anchor (≤ 40 characters). */
function nextAnchor(
  base: string,
  block: Pick<DraftBlock, "id" | "type">,
  doc: DraftDocumentValue
): string {
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const head = base.slice(0, 40 - suffix.length).replace(/-+$/, "")
    const candidate = `${head}${suffix}`
    if (!anchorProblem(candidate, block, doc)) return candidate
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const update = (
  doc: DraftDocumentValue,
  id: string,
  fn: (block: DraftBlock) => DraftBlock
): DraftDocumentValue => ({
  blocks: doc.blocks.map((block) => (block.id === id ? fn(block) : block)),
})

export function docReducer(
  doc: DraftDocumentValue,
  action: DocAction
): DraftDocumentValue {
  switch (action.type) {
    case "add": {
      if (!addableTypes(doc).includes(action.blockType)) return doc
      const block = emptyBlock(action.blockType, doc) as DraftBlock
      const at = isFirstType(action.blockType)
        ? 0
        : clamp(action.at, firstMovable(doc), doc.blocks.length)
      const blocks = [...doc.blocks]
      blocks.splice(at, 0, block)
      return { blocks }
    }
    case "remove":
      return { blocks: doc.blocks.filter((block) => block.id !== action.id) }
    case "move": {
      const from = doc.blocks.findIndex((block) => block.id === action.id)
      if (from < 0 || isFirstType(doc.blocks[from].type)) return doc
      const to = clamp(action.to, firstMovable(doc), doc.blocks.length - 1)
      if (to === from) return doc
      const blocks = [...doc.blocks]
      const [moved] = blocks.splice(from, 1)
      blocks.splice(to, 0, moved)
      return { blocks }
    }
    case "duplicate": {
      const index = doc.blocks.findIndex((block) => block.id === action.id)
      const source = doc.blocks[index]
      if (!source || !addableTypes(doc).includes(source.type)) return doc
      // emptyBlock mints the id (with its insecure-context fallback).
      const fresh = emptyBlock(source.type, doc)
      const copy: DraftBlock = {
        ...source,
        id: fresh.id,
        anchor: anchorFormatError(source.anchor)
          ? fresh.anchor
          : nextAnchor(source.anchor, { id: fresh.id, type: source.type }, doc),
        data: structuredClone(source.data),
      }
      const blocks = [...doc.blocks]
      blocks.splice(index + 1, 0, copy)
      return { blocks }
    }
    case "data":
      if (!isRecord(action.data)) return doc
      return update(doc, action.id, (block) => ({
        ...block,
        data: action.data as Record<string, unknown>,
      }))
    case "meta":
      return update(doc, action.id, (block) => ({
        ...block,
        ...(action.patch.anchor !== undefined && {
          anchor: action.patch.anchor,
        }),
        ...(action.patch.hidden !== undefined && {
          hidden: action.patch.hidden,
        }),
      }))
    case "replace":
      return action.doc
  }
}

/** The block to select after removing `id`: the next one, else the previous. */
export function selectAfterRemove(
  doc: DraftDocumentValue,
  id: string
): string | null {
  const index = doc.blocks.findIndex((block) => block.id === id)
  if (index < 0) return null
  return (doc.blocks[index + 1] ?? doc.blocks[index - 1])?.id ?? null
}

/** Field labels of the block forms (BlockForm) and of error summaries. */
export const BLOCK_FIELD_LABELS: Readonly<Record<string, string>> = {
  image: "Background image",
  crumb: "Breadcrumb label",
  title: "Title",
  description: "Description",
  eyebrow: "Eyebrow",
  heading: "Heading",
  intro: "Intro",
  count: "How many to show",
  items: "Items",
  value: "Figure",
  label: "Label",
  icon: "Icon",
  name: "Name",
  role: "Role",
  lines: "Contact lines",
  text: "Text",
  href: "Link",
  doc: "Text",
  useShared: "Use the shared section",
  anchor: "Anchor",
}

/** "phone24h" → "Phone24h", "whyChooseUs" → "Why choose us". */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const fieldLabel = (key: string) =>
  BLOCK_FIELD_LABELS[key] ?? humanizeKey(key)

/** "data.items.0.title" → "Items 1 › Title"; "" → "" (the block itself). */
function pathLabel(rest: string): string {
  const parts = rest
    .replace(/^data(\.|$)/, "")
    .split(".")
    .filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (/^\d+$/.test(part) && out.length)
      out[out.length - 1] += ` ${Number(part) + 1}`
    else if (part !== "mediaId") out.push(fieldLabel(part))
  }
  return out.join(" › ")
}

const BLOCK_KEY = /^blocks\.(\d+)(?:\.(.+))?$/

/**
 * Publish errors per block id ("blocks.<i>.<path>" → the block at index i
 * of `doc`, which must be the document that was published, not a later
 * edit; see publishErrors), each as "<field>: <message>" for the outline
 * and summaries. Keys outside a block (document, _media) are left out.
 */
export function errorsByBlock(
  fieldErrors: Record<string, string[]>,
  doc: DraftDocumentValue
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const match = BLOCK_KEY.exec(key)
    const block = match ? doc.blocks[Number(match[1])] : undefined
    if (!match || !block) continue
    const rest = match[2] ?? ""
    const label = rest === "type" || rest === "id" ? "" : pathLabel(rest)
    for (const message of messages)
      (out[block.id] ??= []).push(label ? `${label}: ${message}` : message)
  }
  return out
}

/**
 * One block's publish errors split for its editors (`index` in the
 * published snapshot, see publishErrors): `data` keyed by the
 * path inside the block's data (SchemaForm; "_root" for the block as a
 * whole, its type or id), `anchor` for BlockMeta.
 */
export function blockErrors(
  fieldErrors: Record<string, string[]>,
  index: number
): { data: Record<string, string[]>; anchor: string[] } {
  const data: Record<string, string[]> = {}
  const anchor: string[] = []
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const match = BLOCK_KEY.exec(key)
    if (!match || Number(match[1]) !== index) continue
    const rest = match[2] ?? ""
    if (rest === "anchor") anchor.push(...messages)
    else if (rest.startsWith("data."))
      (data[rest.slice("data.".length)] ??= []).push(...messages)
    else (data._root ??= []).push(...messages)
  }
  return { data, anchor }
}

export type BlockPublishErrors = {
  /** "<field>: <message>" lines for the outline badge and summaries. */
  summary: string[]
  /** For BlockForm (data paths, "_root"). */
  data: Record<string, string[]>
  /** For BlockMeta. */
  anchor: string[]
}

/**
 * A publish 422 keyed by block id, mapped once against `published` — the
 * document that was sent. Store the result: re-mapping the index-keyed
 * errors against a later (reordered) document would pin them to whatever
 * block now sits at that index (review D5.4 M1).
 */
export function publishErrors(
  fieldErrors: Record<string, string[]>,
  published: DraftDocumentValue
): Record<string, BlockPublishErrors> {
  const summaries = errorsByBlock(fieldErrors, published)
  const out: Record<string, BlockPublishErrors> = {}
  published.blocks.forEach((block, index) => {
    const { data, anchor } = blockErrors(fieldErrors, index)
    const summary = summaries[block.id] ?? []
    if (summary.length || anchor.length || Object.keys(data).length)
      out[block.id] = { summary, data, anchor }
  })
  return out
}

export type ReadDraft =
  { ok: true; doc: DraftDocumentValue } | { ok: false; problems: string[] }

/**
 * A stored draft as the builder edits it. The editor's document and
 * autosave's saved copy are both read through this one parse. A draft that
 * no longer parses (e.g. saved before a rule existed) is reported, never
 * replaced by an empty page (review D5.5 I2).
 */
export function readDraft(value: unknown): ReadDraft {
  const parsed = DraftDocument.safeParse(value)
  if (parsed.success) return { ok: true, doc: parsed.data }
  const blocks =
    isRecord(value) && Array.isArray(value.blocks) ? value.blocks : []
  const problems: string[] = []
  for (const issue of parsed.error.issues) {
    const [root, index, ...rest] = issue.path
    let line = issue.message
    if (root === "blocks" && typeof index === "number") {
      const type = isRecord(blocks[index]) ? blocks[index].type : undefined
      const label =
        typeof type === "string" && Object.hasOwn(BLOCK_BY_TYPE, type)
          ? BLOCK_BY_TYPE[type as BlockType].label
          : "Block"
      const field = rest.length ? pathLabel(rest.map(String).join(".")) : ""
      line = `Block ${index + 1} (${label})${field ? ` › ${field}` : ""}: ${issue.message}`
    }
    if (!problems.includes(line)) problems.push(line)
  }
  return { ok: false, problems }
}
