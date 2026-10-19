import "server-only"

import { Hono } from "hono"

import { newsletterSubmission } from "@/lib/schemas/api/newsletter"
import type { AppEnv } from "@/server/api/context"
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

/** Form (the unsubscribe page) or JSON `{ token }`; anything else is "". */
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
 * in app.ts. Confirm is a GET (safe: single use); unsubscribe is POST only,
 * so link scanners cannot unsubscribe anyone.
 */
export const publicNewsletterRoutes = new Hono<AppEnv>()
  .post(
    "/",
    // Before validation: every attempt from an IP counts.
    rateLimit(service.NEWSLETTER_LIMIT),
    zv("json", newsletterSubmission),
    async (c) => {
      await service.subscribe(c.req.valid("json"), {
        ip: clientIp(c.req.raw.headers),
      })
      return c.json({ ok: true as const }, 201, NO_STORE)
    }
  )
  .get("/confirm", async (c) => {
    const ok = await service.confirm(c.req.query("token") ?? "")
    return c.redirect(ok ? STATE.confirmed : STATE.invalid, 303)
  })
  .post("/unsubscribe", async (c) => {
    await service.unsubscribe(await readToken(c.req.raw))
    return c.redirect(STATE.unsubscribed, 303)
  })
