import type { MediaRef } from "@/lib/schemas/common"

/** A media row as the public site needs it (spec §5.6). */
export type MediaView = {
  id: string
  url: string
  alt: string
  width: number | null
  height: number | null
  blurDataUrl: string | null
}

/** `T` with every `{ mediaId }` replaced by its MediaView. */
export type WithMedia<T> = T extends MediaRef
  ? MediaView
  : T extends Date
    ? T
    : T extends readonly (infer U)[]
      ? WithMedia<U>[]
      : T extends object
        ? { [K in keyof T]: WithMedia<T[K]> }
        : T

const MEDIA_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Media ids are UUIDs: anything else is never sent to the API as a path. */
export function isMediaId(value: string | null | undefined): value is string {
  return typeof value === "string" && MEDIA_ID_RE.test(value)
}

function isMediaRef(value: unknown): value is MediaRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return (
    keys.length === 1 &&
    keys[0] === "mediaId" &&
    typeof (value as MediaRef).mediaId === "string"
  )
}

/** Every media id referenced anywhere in `value` (JSON-like data). */
export function collectMediaIds(value: unknown, out = new Set<string>()) {
  if (isMediaRef(value)) out.add(value.mediaId)
  else if (Array.isArray(value)) for (const v of value) collectMediaIds(v, out)
  else if (value && typeof value === "object" && !(value instanceof Date))
    for (const v of Object.values(value)) collectMediaIds(v, out)
  return out
}

/** Copy of `value` with each `{ mediaId }` replaced by `resolve(id)`. */
export function replaceMediaRefs<T>(
  value: T,
  resolve: (id: string) => MediaView
): WithMedia<T> {
  const walk = (v: unknown): unknown => {
    if (isMediaRef(v)) return resolve(v.mediaId)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === "object" && !(v instanceof Date))
      return Object.fromEntries(
        Object.entries(v).map(([k, child]) => [k, walk(child)])
      )
    return v
  }
  return walk(value) as WithMedia<T>
}

/** A `{ mediaId }` found in a value, with its dot path ("hero.image", "items.0.icon"). */
export type MediaField = { mediaId: string; field: string }

/** Every media reference in `value` with where it sits (media_usages rows). */
export function collectMediaFields(value: unknown, path = ""): MediaField[] {
  if (isMediaRef(value)) return [{ mediaId: value.mediaId, field: path }]
  const join = (key: string | number) => (path ? `${path}.${key}` : String(key))
  if (Array.isArray(value))
    return value.flatMap((v, i) => collectMediaFields(v, join(i)))
  if (value && typeof value === "object" && !(value instanceof Date))
    return Object.entries(value).flatMap(([k, v]) =>
      collectMediaFields(v, join(k))
    )
  return []
}
