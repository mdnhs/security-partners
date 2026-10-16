// Structural helpers for JSON content (drafts, revisions). Postgres jsonb
// does not keep key order, so comparisons must ignore it.

/** JSON with object keys sorted (stable across jsonb round trips). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          )
        )
      : v
  )
}

/** Deep equality of JSON-like values, ignoring object key order. */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

export type ValueChange = {
  /** Dot path ("hero.heading", "stats.1.label"); "" for the root. */
  path: string
  before: unknown
  after: unknown
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)

/**
 * Leaf-level differences between two JSON values (publish dialog: what will
 * change on the site). Rich text docs and media refs count as one leaf.
 */
export function diffValues(
  before: unknown,
  after: unknown,
  path = ""
): ValueChange[] {
  if (isDeepEqual(before, after)) return []
  const isLeaf = (v: unknown) =>
    isPlainObject(v) && ("mediaId" in v || v.type === "doc")
  if (
    isPlainObject(before) &&
    isPlainObject(after) &&
    !isLeaf(before) &&
    !isLeaf(after)
  ) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    return keys.flatMap((key) =>
      diffValues(before[key], after[key], path ? `${path}.${key}` : key)
    )
  }
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    before.length === after.length
  )
    return before.flatMap((item, i) =>
      diffValues(item, after[i], path ? `${path}.${i}` : String(i))
    )
  return [{ path, before, after }]
}
