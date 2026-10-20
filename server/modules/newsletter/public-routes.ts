import "server-only"

import { Hono } from "hono"

import { newsletterSubmission } from "@/lib/schemas/api/newsletter"
import type { AppEnv } from "@/server/api/context"
import { errorEnvelope } from "@/server/api/middleware/error"
import { rateLimit } from "@/server/api/middleware/rate-limit"
import { zv } from "@/server/api/validate"
import { clientIp } from "@/server/lib/ip"

import * as service from "./service"

const NO_STORE = { "Cache-Control": "no-store" } as const
const STATE = {
  confirmed: "/newsletter/confirmed",
  invalid: "/newsletter/invalid",
  unsubscribed: "/newsletter/unsubscribed",
} as const
const TOKEN_MAX_LENGTH = 200

/** Form (the confirm / unsubscribe views) or JSON `{ token }`; anything else is "". */
async function readToken(req: Request): Promise<string> {
  const type = req.headers.get("content-type") ?? ""
  try {
    if (type.includes("application/json")) {
      const body = (await req.json()) as unknown
      const token = (body as { token?: unknown } | null)?.token
      return typeof token === "string" ? token : ""
    }
    if (
      type.includes("application/x-www-form-urlencoded") ||
      type.includes("multipart/form-data")
    ) {
      const token = (await req.formData()).get("token")
      return typeof token === "string" ? token : ""
    }
  } catch {
    // Malformed body: same answer as a forged token.
  }
  return ""
}

/**
 * /api/v1/public/newsletter — no session; the 64 KB body limit is mounted
 * in app.ts. Every state change is a POST: mail gateways pre-fetch links
 * (GET), so a GET must never confirm or unsubscribe anyone.
 */
export const publicNewsletterRoutes = new Hono<AppEnv>()
  .post(
    "/",
    // Before validation: every attempt from an IP counts.
    rateLimit(service.NEWSLETTER_LIMIT),
    zv("json", newsletterSubmission),
    async (c) => {
      try {
        await service.subscribe(c.req.valid("json"), {
          ip: clientIp(c.req.raw.headers),
        })
      } catch (err) {
        // Per-address limit: same shape as the per-IP 429, with Retry-After.
        if (err instanceof service.NewsletterRateLimitedError)
          return c.json(errorEnvelope(c, err.code, err.message), 429, {
            ...NO_STORE,
            "Retry-After": String(err.retryAfterSeconds),
          })
        throw err
      }
      return c.json({ ok: true as const }, 201, NO_STORE)
    }
  )
  // Side-effect free: links sent before the confirm view existed (or typed
  // by hand) land on the view, whose button POSTs below.
  .get("/confirm", (c) => {
    const token = c.req.query("token") ?? ""
    if (!token || token.length > TOKEN_MAX_LENGTH)
      return c.redirect(STATE.invalid, 303)
    const view = `${service.CONFIRM_VIEW_PATH}?${new URLSearchParams({ token })}`
    // Token-bearing redirect: never cached, never leaked as a referrer.
    c.header("Cache-Control", "no-store")
    c.header("Referrer-Policy", "no-referrer")
    return c.redirect(view, 303)
  })
  .post("/confirm", rateLimit(service.NEWSLETTER_TOKEN_LIMIT), async (c) => {
    const ok = await service.confirm(await readToken(c.req.raw))
    return c.redirect(ok ? STATE.confirmed : STATE.invalid, 303)
  })
  .post(
    "/unsubscribe",
    rateLimit(service.NEWSLETTER_TOKEN_LIMIT),
    async (c) => {
      await service.unsubscribe(await readToken(c.req.raw))
      return c.redirect(STATE.unsubscribed, 303)
    }
  )
