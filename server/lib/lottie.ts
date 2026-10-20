import "server-only"

import { inflateRawSync } from "node:zlib"

/**
 * Lottie uploads (animated logo): a Lottie JSON file or a dotLottie archive
 * (a ZIP holding manifest.json + animations/<id>.json). Validated here
 * before storage; the bytes are stored as uploaded.
 */
export class LottieError extends Error {}

/** Everything a dotLottie may unpack to: bounds the work for us and for visitors' players. */
export const MAX_LOTTIE_UNCOMPRESSED_BYTES = 16 * 1024 * 1024
/** Entries in one dotLottie archive. */
export const MAX_DOTLOTTIE_ENTRIES = 256
/** Canvas size the player may be asked for (w/h of the composition). */
const MAX_DIMENSION = 10_000

export type LottieInfo = { width: number; height: number }

const NOT_LOTTIE = "This JSON file is not a Lottie animation."
const NOT_DOTLOTTIE = "This file is not a dotLottie animation."

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

function parseJson(bytes: Uint8Array, message: string): unknown {
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new LottieError(message)
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ""))
  } catch {
    throw new LottieError(message)
  }
}

function checkAnimation(value: unknown, message: string): LottieInfo {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LottieError(message)
  const a = value as Record<string, unknown>
  const valid =
    typeof a.v === "string" &&
    /^\d+\.\d+(\.\d+)*$/.test(a.v) &&
    isNumber(a.fr) &&
    a.fr > 0 &&
    a.fr <= 1000 &&
    isNumber(a.ip) &&
    isNumber(a.op) &&
    a.op > a.ip &&
    Array.isArray(a.layers) &&
    isNumber(a.w) &&
    isNumber(a.h) &&
    a.w > 0 &&
    a.h > 0 &&
    a.w <= MAX_DIMENSION &&
    a.h <= MAX_DIMENSION
  if (!valid) throw new LottieError(message)
  return { width: Math.round(a.w as number), height: Math.round(a.h as number) }
}

/**
 * A Lottie JSON animation: an object with a version string `v`, frame rate
 * `fr`, in/out points `ip` < `op`, a `layers` list and a positive size.
 */
export function validateLottieJson(
  bytes: Uint8Array,
  message = NOT_LOTTIE
): LottieInfo {
  return checkAnimation(parseJson(bytes, message), message)
}

type CentralEntry = {
  name: string
  flags: number
  method: number
  compressedSize: number
  size: number
  localOffset: number
}

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

/** End of central directory: the last 22-byte record (a comment may follow it). */
function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 0xffff)
  for (let at = view.byteLength - 22; at >= min; at--)
    if (view.getUint32(at, true) === EOCD) return at
  throw new LottieError(NOT_DOTLOTTIE)
}

const safeName = (name: string) =>
  name.length > 0 &&
  name.length <= 255 &&
  !name.startsWith("/") &&
  !name.includes("\\") &&
  !name.includes("\0") &&
  !name.split("/").some((part) => part === ".." || part === ".")

function readCentralDirectory(view: DataView): CentralEntry[] {
  const eocd = findEocd(view)
  const count = view.getUint16(eocd + 10, true)
  const cdSize = view.getUint32(eocd + 12, true)
  const cdOffset = view.getUint32(eocd + 16, true)
  // ZIP64 markers (0xffff / 0xffffffff) never fit a 2 MB upload.
  if (count === 0xffff || cdOffset === 0xffffffff)
    throw new LottieError(NOT_DOTLOTTIE)
  if (count > MAX_DOTLOTTIE_ENTRIES)
    throw new LottieError("This dotLottie file holds too many files.")
  if (cdOffset + cdSize > eocd) throw new LottieError(NOT_DOTLOTTIE)
  const entries: CentralEntry[] = []
  const names = new Set<string>()
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let at = cdOffset
  for (let i = 0; i < count; i++) {
    if (at + 46 > eocd || view.getUint32(at, true) !== CENTRAL)
      throw new LottieError(NOT_DOTLOTTIE)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    if (at + 46 + nameLength > eocd) throw new LottieError(NOT_DOTLOTTIE)
    let name: string
    try {
      name = decoder.decode(
        new Uint8Array(view.buffer, view.byteOffset + at + 46, nameLength)
      )
    } catch {
      throw new LottieError(NOT_DOTLOTTIE)
    }
    if (!safeName(name) || names.has(name)) throw new LottieError(NOT_DOTLOTTIE)
    names.add(name)
    entries.push({
      name,
      flags: view.getUint16(at + 8, true),
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      localOffset: view.getUint32(at + 42, true),
    })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** One entry's bytes; inflating stops at its declared size (zip-bomb guard). */
function readEntry(
  bytes: Uint8Array,
  view: DataView,
  entry: CentralEntry
): Uint8Array {
  const at = entry.localOffset
  if (at + 30 > bytes.byteLength || view.getUint32(at, true) !== LOCAL)
    throw new LottieError(NOT_DOTLOTTIE)
  const start =
    at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
  const end = start + entry.compressedSize
  if (end > bytes.byteLength) throw new LottieError(NOT_DOTLOTTIE)
  const data = bytes.subarray(start, end)
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.size)
      throw new LottieError(NOT_DOTLOTTIE)
    return data
  }
  let out: Buffer
  try {
    // maxOutputLength: a stream that inflates past its declared size throws
    // instead of filling memory.
    out = inflateRawSync(data, { maxOutputLength: Math.max(1, entry.size) })
  } catch {
    throw new LottieError(NOT_DOTLOTTIE)
  }
  if (out.byteLength !== entry.size) throw new LottieError(NOT_DOTLOTTIE)
  return out
}

/**
 * A dotLottie archive: a plain ZIP (no encryption, no ZIP64, stored or
 * deflated entries, safe relative names, at most MAX_DOTLOTTIE_ENTRIES)
 * whose entries unpack to at most MAX_LOTTIE_UNCOMPRESSED_BYTES in all,
 * with a manifest.json listing animations by id, each present as a valid
 * animations/<id>.json. Every entry is unpacked once, so a size that lies
 * is caught too. Returns the first animation's size.
 */
export function validateDotLottie(bytes: Uint8Array): LottieInfo {
  if (bytes.byteLength < 22) throw new LottieError(NOT_DOTLOTTIE)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = readCentralDirectory(view)
  let total = 0
  for (const entry of entries) {
    total += entry.size
    if (total > MAX_LOTTIE_UNCOMPRESSED_BYTES)
      throw new LottieError("This dotLottie file unpacks too large.")
    if (entry.flags & 1)
      throw new LottieError("Encrypted dotLottie files are not supported.")
    if (entry.method !== 0 && entry.method !== 8)
      throw new LottieError(NOT_DOTLOTTIE)
  }
  const files = new Map<string, Uint8Array>()
  for (const entry of entries)
    files.set(entry.name, readEntry(bytes, view, entry))
  const manifestBytes = files.get("manifest.json")
  if (!manifestBytes)
    throw new LottieError(
      "This file is not a dotLottie animation (no manifest.json)."
    )
  const manifest = parseJson(manifestBytes, NOT_DOTLOTTIE) as {
    animations?: unknown
  } | null
  const listed = manifest?.animations
  if (
    !Array.isArray(listed) ||
    listed.length === 0 ||
    !listed.every(
      (a) =>
        a &&
        typeof a === "object" &&
        typeof (a as { id?: unknown }).id === "string" &&
        /^[\w.-]{1,100}$/.test((a as { id: string }).id)
    )
  )
    throw new LottieError(NOT_DOTLOTTIE)
  const ids = (listed as { id: string }[]).map((a) => a.id)
  const infos = new Map<string, LottieInfo>()
  for (const [name, data] of files)
    if (/^animations\/[^/]+\.json$/.test(name))
      infos.set(name, validateLottieJson(data, NOT_DOTLOTTIE))
  const first = infos.get(`animations/${ids[0]}.json`)
  if (!first || !ids.every((id) => infos.has(`animations/${id}.json`)))
    throw new LottieError(NOT_DOTLOTTIE)
  return first
}
