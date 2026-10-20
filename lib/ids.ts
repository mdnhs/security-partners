/**
 * Record ids are uuid v7 (server/db/schema/_shared.ts); the API's `/:id`
 * params accept any RFC uuid (`z.uuid()`: version 1-8, variant 8/9/a/b).
 * Same shape here, anchored, so nothing else passes.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * True only for a record id. Check any id read from the URL (search params,
 * route segments) before it goes into an API path: the Hono client puts
 * `param` values into the path as-is, so `../..` would reach another route.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

/**
 * A fresh v4 uuid for ids minted in the browser (builder blocks, custom
 * code snippets). crypto.randomUUID() exists only in secure contexts, so an
 * admin opened over plain http (LAN, staging IP) falls back to
 * getRandomValues (available everywhere) with the v4 version/variant bits.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
