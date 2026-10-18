import "server-only"

import type { ByteRange } from "@/server/lib/storage/types"

/**
 * One `Range: bytes=…` request against a `size`-byte file (RFC 9110 §14).
 * null = serve the whole file: no header, another unit, a malformed or
 * reversed range, or several ranges (multipart answers are not offered).
 * "unsatisfiable" = 416.
 */
export function parseRange(
  header: string | null | undefined,
  size: number
): ByteRange | "unsatisfiable" | null {
  const match = header?.trim().match(/^bytes\s*=\s*(\d*)\s*-\s*(\d*)$/i)
  if (!match) return null
  const [, first, last] = match
  if (first === "" && last === "") return null
  if (first === "") {
    // Suffix: the last N bytes.
    const length = Number(last)
    if (length === 0 || size === 0) return "unsatisfiable"
    return { start: Math.max(0, size - length), end: size - 1 }
  }
  const start = Number(first)
  if (last !== "" && Number(last) < start) return null
  if (start >= size) return "unsatisfiable"
  const end = last === "" ? size - 1 : Math.min(Number(last), size - 1)
  return { start, end }
}

const opaque = (tag: string) => tag.trim().replace(/^W\//, "")

/** If-None-Match (weak comparison): true = answer 304. */
export function noneMatch(header: string | null | undefined, etag: string) {
  if (!header) return false
  if (header.trim() === "*") return true
  return header.split(",").some((tag) => opaque(tag) === etag)
}

/**
 * If-Range: the Range header applies only when the validator is our current
 * (strong) ETag. We send no Last-Modified, so a date never matches.
 */
export function ifRangeHolds(header: string | null | undefined, etag: string) {
  return !header || header.trim() === etag
}
