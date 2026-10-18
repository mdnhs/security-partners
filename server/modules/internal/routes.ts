import "server-only"

import { Hono } from "hono"

import { revalidateInput } from "@/lib/schemas/api/internal"
import type { AppEnv } from "@/server/api/context"
import { invalidate } from "@/server/lib/cache-tags"
import { AppError, fieldErrorsFromIssues } from "@/server/lib/errors"
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyInternalRequest,
} from "@/server/lib/internal-signature"

/**
 * The scheduler runs on a timer, where revalidateTag throws (no request
 * context, notes §2): it asks this route handler to expire the tags.
 * Signed with the HKDF "cron" key; anything else is 401.
 */
export const internalRoutes = new Hono<AppEnv>().post(
  "/revalidate",
  async (c) => {
    const body = await c.req.text()
    if (
      !verifyInternalRequest({
        body,
        timestamp: c.req.header(TIMESTAMP_HEADER),
        signature: c.req.header(SIGNATURE_HEADER),
      })
    )
      throw new AppError("UNAUTHENTICATED", "Invalid internal signature")
    let json: unknown
    try {
      json = JSON.parse(body)
    } catch {
      throw new AppError("VALIDATION_FAILED", "The body must be JSON")
    }
    const parsed = revalidateInput.safeParse(json)
    if (!parsed.success)
      throw new AppError("VALIDATION_FAILED", "Invalid tags", {
        fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
      })
    invalidate(...parsed.data.tags)
    return c.json({ ok: true as const, count: parsed.data.tags.length }, 200)
  }
)
