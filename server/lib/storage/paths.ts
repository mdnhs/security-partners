import "server-only"

import { resolve, sep } from "node:path"

/** Route of disk and R2 files (server/modules/media/routes.ts mediaFileRoutes). */
export const MEDIA_FILE_PATH = "/api/v1/media/file/"
/** Keys are never reused (replace writes a new key), so files may be cached for a year. */
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const MAX_SEGMENTS = 8

export function isValidKey(key: string): boolean {
  const segments = key.split("/")
  return (
    segments.length >= 1 &&
    segments.length <= MAX_SEGMENTS &&
    segments.every((s) => SEGMENT.test(s) && !s.includes(".."))
  )
}

export function keySegments(key: string): string[] {
  if (!isValidKey(key)) throw new Error(`Invalid media key "${key}"`)
  return key.split("/")
}

/** Absolute path of `key` under `root`; throws if the key is invalid or escapes (ledger ruling). */
export function resolveInside(root: string, key: string): string {
  const base = resolve(root)
  const target = resolve(base, ...keySegments(key))
  if (!target.startsWith(base + sep))
    throw new Error(`Media key "${key}" is outside ${base}`)
  return target
}

/** encodeURIComponent per segment: nested keys keep their "/" (ledger ruling). */
export function encodeKeyPath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/")
}

/** Inverse of encodeKeyPath for a URL path; null for malformed or invalid keys. */
export function decodeKeyPath(path: string): string | null {
  try {
    const key = path.split("/").map(decodeURIComponent).join("/")
    return isValidKey(key) ? key : null
  } catch {
    return null
  }
}

export function mediaFileUrl(key: string): string {
  return MEDIA_FILE_PATH + encodeKeyPath(key)
}

/**
 * Public URL of a media row. Static rows are shipped in public/ (key = URL
 * path, unchanged markup). Disk and R2 rows are served by our own origin,
 * so the default next/image loader and optimizer handle all three
 * (phase 6 correction: a custom loader disables /_next/image).
 */
export function mediaUrl(row: {
  driver: "static" | "disk" | "r2"
  key: string
}): string {
  return row.driver === "static" ? row.key : mediaFileUrl(row.key)
}
