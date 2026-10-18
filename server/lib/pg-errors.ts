import "server-only"

const MAX_DEPTH = 5
// Five characters with at least one digit: every SQLSTATE class has one
// ("23505", "XX000", "P0001"); Node codes such as "EPIPE" have none.
const SQLSTATE = /^(?=[A-Z]*[0-9])[0-9A-Z]{5}$/

/** Errors along `err.cause` (drizzle wraps the pg error), at most MAX_DEPTH deep, no cycles. */
function chain(err: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  let current: unknown = err
  while (
    current !== null &&
    typeof current === "object" &&
    out.length < MAX_DEPTH &&
    !out.includes(current as Record<string, unknown>)
  ) {
    out.push(current as Record<string, unknown>)
    current = (current as { cause?: unknown }).cause
  }
  return out
}

/** Postgres SQLSTATE of a failed query (the first SQLSTATE-shaped `code` along the cause chain). */
export function pgErrorCode(err: unknown): string | undefined {
  for (const e of chain(err))
    if (typeof e.code === "string" && SQLSTATE.test(e.code)) return e.code
  return undefined
}

/** Name of the constraint a failed query violated, e.g. "services_slug_unique". */
export function pgConstraint(err: unknown): string | undefined {
  for (const e of chain(err))
    if (typeof e.constraint === "string") return e.constraint
  return undefined
}

export const UNIQUE_VIOLATION = "23505"
export const FOREIGN_KEY_VIOLATION = "23503"
