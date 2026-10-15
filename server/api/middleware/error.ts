import "server-only"

import type { Context, ErrorHandler, NotFoundHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import type { AppEnv } from "@/server/api/context"
import { AppError, type ErrorCode } from "@/server/lib/errors"

export type ErrorEnvelope = {
  error: {
    code: ErrorCode
    message: string
    fieldErrors?: Record<string, string[]>
    current?: unknown
    requestId: string
  }
}

export function errorEnvelope(
  c: Context<AppEnv>,
  code: ErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string[]>; current?: unknown } = {}
): ErrorEnvelope {
  return { error: { code, message, ...extra, requestId: c.get("requestId") } }
}

const codeForStatus = (status: number): ErrorCode => {
  if (status === 401) return "UNAUTHENTICATED"
  if (status === 403) return "FORBIDDEN"
  if (status === 404) return "NOT_FOUND"
  if (status === 409) return "CONFLICT"
  if (status === 429) return "RATE_LIMITED"
  if (status >= 400 && status < 500) return "VALIDATION_FAILED"
  return "INTERNAL"
}

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) {
    if (err.status >= 500)
      console.error(`[api] ${c.get("requestId")} ${err.code}: ${err.message}`)
    const extra = {
      fieldErrors: err.details?.fieldErrors,
      current: err.details?.current,
    }
    return c.json(errorEnvelope(c, err.code, err.message, extra), err.status)
  }
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode
    const code = codeForStatus(status)
    const message =
      status >= 500 ? "Internal server error" : err.message || "Request failed"
    return c.json(errorEnvelope(c, code, message), status)
  }
  // Unknown error: log with the request id, never send the message or stack.
  console.error(`[api] ${c.get("requestId")} unhandled error`, err)
  return c.json(errorEnvelope(c, "INTERNAL", "Internal server error"), 500)
}

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json(errorEnvelope(c, "NOT_FOUND", "Route not found"), 404)
