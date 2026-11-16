import "server-only"

import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"

import { EmailInput, SendInput, StartChatInput } from "@/lib/schemas/api/chat"
import type { AppEnv } from "@/server/api/context"
import { rateLimit } from "@/server/api/middleware/rate-limit"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import { zv } from "@/server/api/validate"
import { getEnv } from "@/server/env"
import { AppError, fieldErrorsFromIssues } from "@/server/lib/errors"
import { clientIp } from "@/server/lib/ip"
import { CHAT_START_RATE_LIMIT } from "@/server/lib/rate-limit"

import {
  CHAT_COOKIE,
  CHAT_COOKIE_MAX_AGE,
  CHAT_COOKIE_PATH,
  requireEnabled,
} from "./settings"
import * as visitor from "./visitor"

// Port of JW server/modules/chat/public-routes.ts (live chat plan, Task 3).

/** Off, unpublished or invalid settings → 404 before anything is written. */
const chatEnabled = createMiddleware<AppEnv>(async (_c, next) => {
  await requireEnabled()
  await next()
})

const isHoneypot = (raw: unknown) =>
  !!raw &&
  typeof raw === "object" &&
  typeof (raw as { website?: unknown }).website === "string" &&
  (raw as { website: string }).website.trim() !== ""

/** /api/v1/public/chat — no session; the visitor holds the cp_chat cookie. */
export const chatPublicRoutes = new Hono<AppEnv>()
  .use(sameOrigin())
  .use(chatEnabled)
  .get("/status", async (c) => {
    c.header("Cache-Control", "no-store")
    return c.json(await visitor.status(), 200)
  })
  .post("/start", rateLimit(CHAT_START_RATE_LIMIT), async (c) => {
    const raw: unknown = await c.req.json().catch(() => ({}))
    // Honeypot: look like a success, store nothing.
    if (isHoneypot(raw)) return c.json({ ok: true as const }, 201)
    const ip = clientIp(c.req.raw.headers)
    // An open chat for this cookie: no second chat. The typed message goes
    // through the normal send path; a missing or invalid one just shows it.
    const existing = await visitor.findByToken(getCookie(c, CHAT_COOKIE))
    if (existing && existing.status === "open") {
      const typed = SendInput.safeParse({
        body: (raw as { message?: unknown }).message,
      })
      if (typed.success) await visitor.send(existing, typed.data.body, ip)
      const fresh = await visitor.findByToken(getCookie(c, CHAT_COOKIE))
      return c.json(await visitor.view(fresh ?? existing), 201)
    }
    const parsed = StartChatInput.safeParse(raw)
    if (!parsed.success)
      throw new AppError("VALIDATION_FAILED", "Invalid input", {
        fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
      })
    const { token, view } = await visitor.start(parsed.data, ip)
    setCookie(c, CHAT_COOKIE, token, {
      httpOnly: true,
      secure: getEnv().BETTER_AUTH_URL.startsWith("https:"),
      sameSite: "Lax",
      path: CHAT_COOKIE_PATH,
      maxAge: CHAT_COOKIE_MAX_AGE,
    })
    return c.json(view, 201)
  })
  .get("/conversation", async (c) => {
    c.header("Cache-Control", "no-store")
    // No cookie: 404 before any database write (the rate limit stores a row).
    const token = getCookie(c, CHAT_COOKIE)
    if (!token) throw new AppError("NOT_FOUND", "Chat not found")
    await visitor.pollLimit(clientIp(c.req.raw.headers))
    const chat = await visitor.requireChat(token)
    const after = Number.parseInt(c.req.query("after") ?? "", 10)
    return c.json(await visitor.view(chat, after > 0 ? after : 0), 200)
  })
  .post("/messages", zv("json", SendInput), async (c) => {
    const chat = await visitor.requireChat(getCookie(c, CHAT_COOKIE))
    const row = await visitor.send(
      chat,
      c.req.valid("json").body,
      clientIp(c.req.raw.headers)
    )
    return c.json({ ok: true as const, id: row.id }, 201)
  })
  .post("/email", zv("json", EmailInput), async (c) => {
    const chat = await visitor.requireChat(getCookie(c, CHAT_COOKIE))
    await visitor.saveEmail(chat, c.req.valid("json").email)
    return c.json({ ok: true as const }, 200)
  })
  .post("/end", async (c) => {
    const chat = await visitor.requireChat(getCookie(c, CHAT_COOKIE))
    await visitor.end(chat)
    return c.json({ ok: true as const }, 200)
  })
