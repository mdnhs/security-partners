import "server-only"

export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export const STATUS_BY_CODE = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const satisfies Record<ErrorCode, number>

export type ErrorDetails = {
  fieldErrors?: Record<string, string[]>
  current?: unknown
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: ErrorDetails

  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.details = details
  }

  get status(): (typeof STATUS_BY_CODE)[ErrorCode] {
    return STATUS_BY_CODE[this.code]
  }
}

export const notFound = (what: string) =>
  new AppError("NOT_FOUND", `${what} not found`)
export const forbidden = () =>
  new AppError("FORBIDDEN", "You do not have permission to do this")
export const conflict = (current: unknown) =>
  new AppError(
    "CONFLICT",
    "This record was changed by someone else. Reload to see the latest version.",
    { current }
  )

type IssueLike = { path: ReadonlyArray<PropertyKey>; message: string }

/** Zod issues → `{ "hero.heading": ["Required"] }`. Root-level issues use the key "_root". */
export function fieldErrorsFromIssues(
  issues: ReadonlyArray<IssueLike>
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_root"
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}
