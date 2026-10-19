import { APICallError, simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/server/modules/ai/providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/ai/providers")>()
  return { ...actual, createLanguageModel: vi.fn() }
})

import { type ChatStreamEvent, readChatStream } from "@/lib/ai/chat-stream"
import type {
  AiConversationDto,
  AiConversationSummary,
  AiStatusDto,
} from "@/lib/schemas/api/ai"
import type { Paginated } from "@/lib/schemas/api/list"
import { getDb } from "@/server/db/client"
import { aiConversations, aiMessages, settings } from "@/server/db/schema"
import { encryptSecret } from "@/server/lib/crypto"
import { ASSISTANT_RULES } from "@/server/modules/ai/prompt"
import { createLanguageModel } from "@/server/modules/ai/providers"

import { resetDb } from "../db"
import { adminRequest, mergeCookies, signedInUser } from "../helpers/auth"

const API_KEY = "sk-ant-test-key-9876"

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 4, text: 4, reasoning: undefined },
}

function replying(...deltas: string[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t1" },
          ...deltas.map((delta) => ({
            type: "text-delta" as const,
            id: "t1",
            delta,
          })),
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage,
          },
        ],
      }),
    }),
  })
}

function rejecting(statusCode: number) {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new APICallError({
        message: `invalid x-api-key ${API_KEY}`,
        url: "https://api.anthropic.com/v1/messages",
        requestBodyValues: {},
        statusCode,
        isRetryable: false,
      })
    },
  })
}

/** The mock model used for the n-th chat call. */
const modelOf = (n: number) =>
  vi.mocked(createLanguageModel).mock.results[n].value as MockLanguageModelV4

type Person = { id: string; cookie: string }
let owner: Person
let admin: Person
let editor: Person
let author: Person
let viewer: Person

async function person(roles: Parameters<typeof signedInUser>[0]) {
  const { user, cookie } = await signedInUser(roles)
  return { id: user.id, cookie }
}

beforeEach(async () => {
  await resetDb()
  owner = await person(["owner"])
  admin = await person(["admin"])
  editor = await person(["editor"])
  author = await person(["author"])
  viewer = await person(["viewer"])
  vi.mocked(createLanguageModel)
    .mockReset()
    .mockImplementation(() => replying("Hello ", "world"))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function configureAi(values: Record<string, unknown> = {}) {
  const res = await adminRequest("/integrations/integrations.ai", {
    cookie: owner.cookie,
    method: "PUT",
    json: {
      version: 0,
      values: {
        enabled: true,
        provider: "anthropic",
        model: "claude-sonnet-5-5",
        apiKey: API_KEY,
        allowedRoles: ["owner", "editor"],
        ...values,
      },
    },
  })
  expect(res.status).toBe(200)
}

const status = async (cookie: string) =>
  (await (await adminRequest("/ai/status", { cookie })).json()) as AiStatusDto

const chat = (cookie: string, json: unknown) =>
  adminRequest("/ai/chat", { cookie, method: "POST", json })

async function events(res: Response) {
  const out: ChatStreamEvent[] = []
  for await (const event of readChatStream(res.body!)) out.push(event)
  return out
}

const startedId = (list: ChatStreamEvent[]) =>
  (list[0] as { type: "start"; conversationId: string }).conversationId

async function messagesOf(conversationId: string) {
  return getDb()
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt, aiMessages.id)
}

const context = {
  screen: "Home page",
  entityType: "page",
  entityId: "home",
  field: {
    path: "hero.heading",
    label: "Heading",
    value: "Old heading",
    maxLength: 80,
  },
  record: { hero: { heading: "Old heading" } },
}

describe("GET /api/v1/admin/ai/status", () => {
  it("is off until configured, then on only for allowed roles", async () => {
    expect(await status(owner.cookie)).toEqual({
      available: false,
      canManage: true,
      reason: "unconfigured",
      model: null,
      readOnly: false,
    })
    await configureAi()
    expect(await status(owner.cookie)).toEqual({
      available: true,
      canManage: true,
      reason: null,
      model: "claude-sonnet-5-5",
      readOnly: false,
    })
    expect((await status(editor.cookie)).available).toBe(true)
    // admin and author hold ai:use but are not in allowedRoles; viewer has no ai:use.
    expect(await status(admin.cookie)).toEqual({
      available: false,
      canManage: true,
      reason: "not-allowed",
      model: null,
      readOnly: false,
    })
    expect((await status(author.cookie)).available).toBe(false)
    expect((await status(viewer.cookie)).available).toBe(false)
  })

  it("is off again when turned off in Settings", async () => {
    await configureAi()
    const res = await adminRequest("/integrations/integrations.ai", {
      cookie: owner.cookie,
      method: "PUT",
      json: { version: 1, values: { enabled: false } },
    })
    expect(res.status).toBe(200)
    expect((await status(owner.cookie)).available).toBe(false)
  })
})

describe("POST /api/v1/admin/ai/chat — access (master 9.1)", () => {
  it("disabled → 404 for chat and conversations", async () => {
    const off = await chat(owner.cookie, { message: "Hi" })
    expect(off.status).toBe(404)
    expect(((await off.json()) as { error: { code: string } }).error.code).toBe(
      "NOT_FOUND"
    )
    expect(
      (await adminRequest("/ai/conversations", { cookie: owner.cookie })).status
    ).toBe(404)
    await configureAi({ enabled: false })
    expect((await chat(owner.cookie, { message: "Hi" })).status).toBe(404)
    expect(createLanguageModel).not.toHaveBeenCalled()
  })

  it("role allow-list: viewer (no ai:use) and roles outside allowedRoles → 403", async () => {
    await configureAi()
    expect((await chat(viewer.cookie, { message: "Hi" })).status).toBe(403)
    expect((await chat(author.cookie, { message: "Hi" })).status).toBe(403)
    expect((await chat(admin.cookie, { message: "Hi" })).status).toBe(403)
    const ok = await chat(editor.cookie, { message: "Hi" })
    expect(ok.status).toBe(200)
    await events(ok)
  })

  it("uses the provider, model and key saved in integrations.ai", async () => {
    await configureAi({ provider: "anthropic", model: "claude-opus-5-5" })
    await events(await chat(owner.cookie, { message: "Hi" }))
    expect(createLanguageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "anthropic",
        model: "claude-opus-5-5",
        apiKey: API_KEY,
      })
    )
  })

  it("validates the message and caps the screen data (422)", async () => {
    await configureAi()
    const empty = await chat(editor.cookie, { message: "   " })
    expect(empty.status).toBe(422)
    const big = await chat(editor.cookie, {
      message: "Hi",
      context: { ...context, record: { body: "x".repeat(30_001) } },
    })
    expect(big.status).toBe(422)
    const body = (await big.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toEqual(["context.record"])
  })
})

describe("POST /api/v1/admin/ai/chat — streaming and persistence", () => {
  it("streams the answer and stores the conversation for its user", async () => {
    await configureAi()
    const res = await chat(editor.cookie, {
      message: "Rewrite the heading",
      context,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/^application\/x-ndjson/)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const list = await events(res)
    const conversationId = startedId(list)
    expect(list[0]).toEqual({ type: "start", conversationId })
    expect(list.flatMap((e) => (e.type === "text" ? [e.text] : []))).toEqual([
      "Hello ",
      "world",
    ])
    expect(list.at(-1)).toEqual({ type: "done", messageId: expect.any(String) })

    // What the model received: the rules first (then who is asking, the
    // tools and the screen name, MK parity C8), then the screen as a
    // user-role context message right before the question.
    const call = modelOf(0).doStreamCalls[0]
    const system = call.prompt[0] as { role: string; content: string }
    expect(system.role).toBe("system")
    expect(system.content.startsWith(ASSISTANT_RULES)).toBe(true)
    // The record never goes into the instructions.
    expect(system.content).not.toContain("Old heading")
    const [screen, question] = call.prompt.slice(1) as {
      role: string
      content: { type: string; text: string }[]
    }[]
    expect(call.prompt).toHaveLength(3)
    expect(screen.role).toBe("user")
    const screenText = screen.content[0].text
    expect(screenText).toMatch(/^<screen-context>\n/)
    expect(screenText).toContain("Screen: Home page (page home)")
    expect(screenText).toContain('Focused field: "Heading" (hero.heading)')
    expect(screenText).toContain('{"hero":{"heading":"Old heading"}}')
    expect(question).toEqual({
      role: "user",
      content: [{ type: "text", text: "Rewrite the heading" }],
    })
    // The saved "longest answer" (default 1024).
    expect(call.maxOutputTokens).toBe(1024)

    const [row] = await getDb()
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, conversationId))
    expect(row).toMatchObject({
      userId: editor.id,
      title: "Rewrite the heading",
      // The screen only: never the record or the field value.
      context: { screen: "Home page", entityType: "page", entityId: "home" },
    })
    expect(await messagesOf(conversationId)).toEqual([
      { role: "user", content: "Rewrite the heading" },
      { role: "assistant", content: "Hello world" },
    ])
  })

  it("continues a conversation with its history; other users cannot see it", async () => {
    await configureAi()
    const first = await events(await chat(editor.cookie, { message: "One" }))
    const conversationId = startedId(first)
    vi.mocked(createLanguageModel).mockImplementation(() => replying("Shorter"))
    const second = await events(
      await chat(editor.cookie, { conversationId, message: "Two" })
    )
    expect(startedId(second)).toBe(conversationId)
    expect(
      modelOf(1)
        .doStreamCalls[0].prompt.slice(1)
        .map((m) => m.role)
    ).toEqual(["user", "assistant", "user"])

    // Another user's conversation id reads as missing.
    expect(
      (await chat(owner.cookie, { conversationId, message: "Hijack" })).status
    ).toBe(404)
    const ownerList = (await (
      await adminRequest("/ai/conversations", { cookie: owner.cookie })
    ).json()) as Paginated<AiConversationSummary>
    expect(ownerList).toEqual({ items: [], page: 1, pageSize: 20, total: 0 })
    expect(
      (
        await adminRequest(`/ai/conversations/${conversationId}`, {
          cookie: owner.cookie,
        })
      ).status
    ).toBe(404)
    expect(
      (
        await adminRequest(`/ai/conversations/${conversationId}`, {
          cookie: owner.cookie,
          method: "DELETE",
        })
      ).status
    ).toBe(404)

    const mine = (await (
      await adminRequest("/ai/conversations", { cookie: editor.cookie })
    ).json()) as Paginated<AiConversationSummary>
    expect(mine.total).toBe(1)
    expect(mine.items[0]).toMatchObject({ id: conversationId, title: "One" })
    const detail = (await (
      await adminRequest(`/ai/conversations/${conversationId}`, {
        cookie: editor.cookie,
      })
    ).json()) as AiConversationDto
    expect(detail.messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "One"],
      ["assistant", "Hello world"],
      ["user", "Two"],
      ["assistant", "Shorter"],
    ])

    const removed = await adminRequest(`/ai/conversations/${conversationId}`, {
      cookie: editor.cookie,
      method: "DELETE",
    })
    expect(removed.status).toBe(200)
    expect(await removed.json()).toEqual({ ok: true })
    expect(await messagesOf(conversationId)).toEqual([])
  })

  it("lists the newest conversation first", async () => {
    await configureAi()
    const a = startedId(
      await events(await chat(editor.cookie, { message: "A" }))
    )
    const b = startedId(
      await events(await chat(editor.cookie, { message: "B" }))
    )
    await events(
      await chat(editor.cookie, { conversationId: a, message: "A2" })
    )
    const list = (await (
      await adminRequest("/ai/conversations?pageSize=1", {
        cookie: editor.cookie,
      })
    ).json()) as Paginated<AiConversationSummary>
    expect(list).toMatchObject({ page: 1, pageSize: 1, total: 2 })
    expect(list.items.map((c) => c.id)).toEqual([a])
    expect(b).not.toBe(a)
  })

  it("streams a provider failure as a message, logs no key, stores no reply", async () => {
    await configureAi()
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(createLanguageModel).mockImplementation(() => rejecting(401))
    const res = await chat(editor.cookie, { message: "Hi" })
    expect(res.status).toBe(200)
    const text = await res.clone().text()
    expect(text).not.toContain(API_KEY)
    const list = await events(res)
    expect(list.map((e) => e.type)).toEqual(["start", "error"])
    expect((list[1] as { message: string }).message).toMatch(
      /rejected the API key/
    )
    expect(await messagesOf(startedId(list))).toEqual([
      { role: "user", content: "Hi" },
    ])
    const logged = log.mock.calls.map((c) => c.join(" ")).join("\n")
    expect(logged).toContain("[ai] answer failed: AI_APICallError 401")
    expect(logged).not.toContain(API_KEY)
  })

  it("rate limit: the 31st message in 10 minutes → 429 for that user only", async () => {
    await configureAi()
    for (let i = 0; i < 30; i++) {
      const res = await chat(editor.cookie, { message: `Message ${i}` })
      expect(res.status).toBe(200)
      await events(res)
    }
    const calls = vi.mocked(createLanguageModel).mock.calls.length
    const limited = await chat(editor.cookie, { message: "One more" })
    expect(limited.status).toBe(429)
    expect(
      ((await limited.json()) as { error: { code: string } }).error.code
    ).toBe("RATE_LIMITED")
    expect(createLanguageModel).toHaveBeenCalledTimes(calls)
    const other = await chat(owner.cookie, { message: "Hi" })
    expect(other.status).toBe(200)
    await events(other)
  })

  it("rate limit: deleting conversations does not reset it", async () => {
    await configureAi()
    const ids = new Set<string>()
    for (let i = 0; i < 30; i++)
      ids.add(
        startedId(await events(await chat(editor.cookie, { message: `M${i}` })))
      )
    for (const id of ids) {
      const removed = await adminRequest(`/ai/conversations/${id}`, {
        cookie: editor.cookie,
        method: "DELETE",
      })
      expect(removed.status).toBe(200)
    }
    expect(await getDb().select().from(aiMessages)).toEqual([])
    expect((await chat(editor.cookie, { message: "Again" })).status).toBe(429)
  })

  it("rate limit: a parallel burst never goes over 30", async () => {
    await configureAi()
    const responses = await Promise.all(
      Array.from({ length: 36 }, (_, i) =>
        chat(editor.cookie, { message: `Burst ${i}` })
      )
    )
    const statuses = responses.map((r) => r.status)
    expect(statuses.filter((s) => s === 200)).toHaveLength(30)
    expect(statuses.filter((s) => s === 429)).toHaveLength(6)
    await Promise.all(
      responses.map((r) => (r.status === 200 ? events(r) : r.text()))
    )
    const stored = await getDb()
      .select({ id: aiMessages.id })
      .from(aiMessages)
      .where(eq(aiMessages.role, "user"))
    expect(stored).toHaveLength(30)
  })

  it("stopping mid-answer stores no assistant message", async () => {
    await configureAi()
    let aborted = false
    vi.mocked(createLanguageModel).mockImplementation(
      () =>
        new MockLanguageModelV4({
          doStream: async ({ abortSignal }) => {
            abortSignal?.addEventListener("abort", () => {
              aborted = true
            })
            return {
              stream: simulateReadableStream({
                chunkDelayInMs: 40,
                chunks: [
                  { type: "text-start", id: "t1" },
                  ...Array.from({ length: 20 }, (_, i) => ({
                    type: "text-delta" as const,
                    id: "t1",
                    delta: `w${i} `,
                  })),
                  { type: "text-end", id: "t1" },
                  {
                    type: "finish",
                    finishReason: { unified: "stop", raw: "stop" },
                    usage,
                  },
                ],
              }),
            }
          },
        })
    )
    const res = await chat(editor.cookie, { message: "Long answer" })
    expect(res.status).toBe(200)
    const reader = readChatStream(res.body!)
    const first = (await reader.next()).value as ChatStreamEvent
    expect(first.type).toBe("start")
    const conversationId = (first as { conversationId: string }).conversationId
    expect((await reader.next()).value).toMatchObject({ type: "text" })
    // The client stops reading: the body is cancelled.
    await reader.return(undefined)
    await res.body!.cancel()
    await vi.waitFor(() => expect(aborted).toBe(true))
    // Give the rest of the (aborted) stream time to finish.
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(await messagesOf(conversationId)).toEqual([
      { role: "user", content: "Long answer" },
    ])
  })

  it("settings whose key no longer decrypts read as off (logged once, no values)", async () => {
    await configureAi()
    const [row] = await getDb()
      .select({ draft: settings.draft })
      .from(settings)
      .where(eq(settings.key, "integrations.ai"))
    const draft = row.draft as Record<string, unknown>
    // A ciphertext bound to another field: the AAD no longer matches.
    await getDb()
      .update(settings)
      .set({
        draft: {
          ...draft,
          apiKey: encryptSecret(API_KEY, "integrations.smtp.password"),
        },
      })
      .where(eq(settings.key, "integrations.ai"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await status(owner.cookie)).toEqual({
      available: false,
      canManage: true,
      reason: "unconfigured",
      model: null,
      readOnly: false,
    })
    expect((await chat(owner.cookie, { message: "Hi" })).status).toBe(404)
    expect(createLanguageModel).not.toHaveBeenCalled()
    const lines = log.mock.calls.map((c) => c.join(" "))
    expect(lines.filter((l) => l === "[ai] settings unreadable")).toHaveLength(
      1
    )
    expect(lines.join("\n")).not.toContain(API_KEY)
  })

  it("read-only while viewing the admin as someone else", async () => {
    await configureAi()
    const mine = startedId(
      await events(await chat(editor.cookie, { message: "Mine" }))
    )
    const start = await adminRequest(`/users/${editor.id}/impersonate`, {
      cookie: admin.cookie,
      method: "POST",
    })
    expect(start.status).toBe(200)
    const asEditor = mergeCookies(admin.cookie, start)
    expect(await status(asEditor)).toEqual({
      available: true,
      canManage: false,
      reason: null,
      model: "claude-sonnet-5-5",
      readOnly: true,
    })
    expect((await chat(asEditor, { message: "As editor" })).status).toBe(403)
    expect(
      (
        await adminRequest(`/ai/conversations/${mine}`, {
          cookie: asEditor,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
    expect(
      (await adminRequest("/ai/conversations", { cookie: asEditor })).status
    ).toBe(200)
  })
})

describe("Test connection (Phase 6 endpoint) with the Claude 5.5 default", () => {
  it("asks the provider for the saved model, spending no tokens", async () => {
    await configureAi()
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "claude-sonnet-5-5" })
    )
    vi.stubGlobal("fetch", fetchMock)
    const res = await adminRequest("/integrations/integrations.ai/test", {
      cookie: owner.cookie,
      method: "POST",
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      "https://api.anthropic.com/v1/models/claude-sonnet-5-5"
    )
  })
})
