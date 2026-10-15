import "server-only"

import { bodyLimit } from "hono/body-limit"

import { errorEnvelope } from "./error"

export const BODY_LIMITS = {
  public: 64 * 1024,
  admin: 1024 * 1024,
  upload: 20 * 1024 * 1024,
} as const

export type BodyLimitKind = keyof typeof BODY_LIMITS

/** 413 with the standard envelope (code VALIDATION_FAILED) when the body exceeds the limit. */
export const limitBody = (kind: BodyLimitKind) =>
  bodyLimit({
    maxSize: BODY_LIMITS[kind],
    onError: (c) =>
      c.json(
        errorEnvelope(
          c,
          "VALIDATION_FAILED",
          `Request body exceeds ${BODY_LIMITS[kind] / 1024} KB`
        ),
        413
      ),
  })
