import "server-only"

/** Postgres SQLSTATE of a failed query (drizzle wraps the pg error in `cause`). */
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null
  const code = e?.cause?.code ?? e?.code
  return typeof code === "string" ? code : undefined
}

/** Name of the constraint a failed query violated, e.g. "services_slug_unique". */
export function pgConstraint(err: unknown): string | undefined {
  const e = err as {
    constraint?: unknown
    cause?: { constraint?: unknown }
  } | null
  const name = e?.cause?.constraint ?? e?.constraint
  return typeof name === "string" ? name : undefined
}

export const UNIQUE_VIOLATION = "23505"
export const FOREIGN_KEY_VIOLATION = "23503"
