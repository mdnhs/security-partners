import "server-only"

import type { MiddlewareHandler } from "hono"
import { bodyLimit } from "hono/body-limit"

import { MAX_UPLOAD_BYTES } from "@/lib/schemas/api/media"
import type { AppEnv } from "@/server/api/context"

import { errorEnvelope } from "./error"

/** Global constraint: public 64 KB, admin 1 MB, uploads 20 MB (+ multipart envelope). */
export const BODY_LIMITS = {
  public: 64 * 1024,
  admin: 1024 * 1024,
  upload: MAX_UPLOAD_BYTES + 64 * 1024,
} as const

export type BodyLimitKind = keyof typeof BODY_LIMITS

const limitMessage = (kind: BodyLimitKind) =>
  kind === "upload"
    ? `Files can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`
    : `Request body exceeds ${BODY_LIMITS[kind] / 1024} KB`

/** 413 with the standard envelope (code VALIDATION_FAILED) when the body exceeds the limit. */
export const limitBody = (kind: BodyLimitKind) =>
  bodyLimit({
    maxSize: BODY_LIMITS[kind],
    onError: (c) =>
      c.json(errorEnvelope(c, "VALIDATION_FAILED", limitMessage(kind)), 413),
  })

const UPLOAD_PATH =
  /^\/api\/v1\/admin\/media\/(?:upload|[0-9a-fA-F-]{36}\/replace)$/

export const isUploadPath = (path: string) => UPLOAD_PATH.test(path)

const adminLimit = limitBody("admin")
const uploadLimit = limitBody("upload")

/**
 * The admin chain's body limit, chosen by path (ledger ruling): the two
 * upload endpoints get 20 MB, everything else 1 MB. A single outer 1 MB
 * limit would reject every upload before its route runs.
 */
export const limitAdminBody: MiddlewareHandler<AppEnv> = (c, next) =>
  isUploadPath(c.req.path) ? uploadLimit(c, next) : adminLimit(c, next)
