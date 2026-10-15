import { hc } from "hono/client"

import type { AdminApi } from "@/server/api/app"

/**
 * Typed client for /api/v1/admin (same origin, session cookie). Only the
 * route *types* come from server/ (type-only import, erased at build).
 */
export const api = hc<AdminApi>("/api/v1/admin")

/** The API error envelope (server/api/middleware/error.ts). */
export type ApiErrorBody = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    current?: unknown
    requestId?: string
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: Record<string, string[]>
  readonly current: unknown
  readonly requestId: string | null

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.error?.message ?? `Request failed (${status})`)
    this.name = "ApiError"
    this.status = status
    this.code = body?.error?.code ?? "INTERNAL"
    this.fieldErrors = body?.error?.fieldErrors ?? {}
    this.current = body?.error?.current
    this.requestId = body?.error?.requestId ?? null
  }

  get isConflict(): boolean {
    return this.status === 409
  }
}

type JsonResponse<T> = {
  ok: boolean
  status: number
  json(): Promise<T>
}

/** Awaits an `api.*.$get()/$post()…` call: the JSON body, or throws ApiError. */
export async function unwrap<T>(request: Promise<JsonResponse<T>>): Promise<T> {
  const res = await request
  if (res.ok) return res.json()
  let body: Partial<ApiErrorBody> | null = null
  try {
    body = (await res.json()) as Partial<ApiErrorBody>
  } catch {
    body = null
  }
  throw new ApiError(res.status, body)
}

/** Human message for a failed request (toasts, inline alerts). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return "Something went wrong. Check your connection and try again."
}
