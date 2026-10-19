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
