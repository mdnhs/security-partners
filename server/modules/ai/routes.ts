import "server-only"

import { Hono } from "hono"

import { CHAT_STREAM_CONTENT_TYPE } from "@/lib/ai/chat-stream"
import { chatInput, conversationsQuery } from "@/lib/schemas/api/ai"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** AI assistant (spec §7 `ai/chat`, `ai/conversations`; §8.3). */
export const aiRoutes = new Hono<AppEnv>()
  // Any signed-in user: tells the shell whether to show the assistant.
  .get("/status", async (c) =>
    c.json(await service.getAiStatus(actorOf(c)), 200)
  )
  .post("/chat", can({ ai: ["use"] }), zv("json", chatInput), async (c) => {
    const { stream } = await service.chat(actorOf(c), c.req.valid("json"), {
      signal: c.req.raw.signal,
    })
    return c.body(stream, 200, {
      "content-type": CHAT_STREAM_CONTENT_TYPE,
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    })
  })
  .get(
    "/conversations",
    can({ ai: ["use"] }),
    zv("query", conversationsQuery),
    async (c) =>
      c.json(
        await service.listConversations(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .get(
    "/conversations/:id",
    can({ ai: ["use"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.getConversation(actorOf(c), c.req.valid("param").id),
        200
      )
  )
  .delete(
    "/conversations/:id",
    can({ ai: ["use"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.deleteConversation(actorOf(c), c.req.valid("param").id),
        200
      )
  )
