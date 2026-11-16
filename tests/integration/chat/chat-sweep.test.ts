import { MockLanguageModelV4 } from "ai/test"
import { eq, sql } from "drizzle-orm"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest"

vi.mock("@/server/modules/ai/providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/ai/providers")>()
  return { ...actual, createLanguageModel: vi.fn() }
})

const botMock = vi.hoisted(() => ({
  fail: null as Error | null,
}))
vi.mock("@/server/modules/chat/bot", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/chat/bot")>()
  return {
    ...actual,
    maybeReply: async (id: string) => {
      if (botMock.fail) throw botMock.fail
      return actual.maybeReply(id)
    },
  }
})

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { getDb } from "@/server/db/client"
import { auditLog, chatMessages, settings } from "@/server/db/schema"
import { encryptSecret } from "@/server/lib/crypto"
import { chatSweepJob } from "@/server/lib/jobs/chat-sweep"
import { purgeChatsJob } from "@/server/lib/jobs/purge-chats"
import { mailer } from "@/server/lib/mailer"
import { createLanguageModel } from "@/server/modules/ai/providers"
import { clearKnowledgeCache } from "@/server/modules/chat/knowledge"
import * as repo from "@/server/modules/chat/repo"

import { resetDb } from "../db"

const WAITING = "A chat visitor is waiting for a reply"
const ENDED = CHAT_SETTINGS_DEFAULT.notices.ended

async function put(key: string, draft: unknown, published: unknown = draft) {
  await getDb()
    .insert(settings)
    .values({ key, draft, published, version: 1 })
    .onConflictDoUpdate({ target: settings.key, set: { draft, published } })
}

function publishChat(
  patch: Record<string, unknown> = {},
  botPatch: Record<string, unknown> = {}
) {
  return put("chat", {
    ...CHAT_SETTINGS_DEFAULT,
    enabled: true,
    ...patch,
    bot: { ...CHAT_SETTINGS_DEFAULT.bot, enabled: true, ...botPatch },
  })
}

/** integrations.ai is read from its draft, with the key sealed as the save does. */
function saveAi() {
  return put(
    "integrations.ai",
    {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      allowedRoles: ["owner"],
      apiKey: encryptSecret("sk-ant-test-key-4321", "integrations.ai.apiKey"),
    },
    null
  )
}

let calls = 0
const model = () =>
  new MockLanguageModelV4({
    doGenerate: async () => {
      calls += 1
      return {
        content: [{ type: "text" as const, text: `Reply ${calls}` }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
          inputTokens: {
            total: 1,
            noCache: 1,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      }
    },
  })

let n = 0
async function start() {
  n += 1
  const { chat } = await repo.createConversation({
    tokenHash: `sweep-hash-${n}`,
    visitorName: "Visitor",
    sourcePath: "/services",
    firstMessage: "Hello there",
  })
  return chat.id
}

/** Moves the chat's clocks back by `seconds`, in DB time. */
async function age(id: string, seconds: number) {
  await getDb().execute(sql`
    update chat_conversations set
      last_message_at = now() - ${seconds} * interval '1 second',
      last_visitor_message_at = now() - ${seconds} * interval '1 second',
      created_at = now() - ${seconds} * interval '1 second'
    where id = ${id}`)
}

/** Moves every clock of the chat back by `seconds`, keeping their order. */
async function shift(id: string, seconds: number) {
  const back = sql`${seconds} * interval '1 second'`
  await getDb().execute(sql`
    update chat_conversations set
      last_message_at = last_message_at - ${back},
      last_visitor_message_at = last_visitor_message_at - ${back},
      last_reply_at = last_reply_at - ${back},
      no_reply_alerted_at = no_reply_alerted_at - ${back}
    where id = ${id}`)
}

const set = (id: string, assignments: ReturnType<typeof sql>) =>
  getDb().execute(
    sql`update chat_conversations set ${assignments} where id = ${id}`
  )

const rows = (id: string) =>
  getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(chatMessages.id)

const sweep = () => chatSweepJob.run({ now: new Date(), payload: null })
const purge = (now = new Date()) => purgeChatsJob.run({ now, payload: null })

let sendSpy: MockInstance<typeof mailer.send>
const waitingAlerts = () =>
  sendSpy.mock.calls.filter(([m]) => m.subject === WAITING).length

beforeEach(async () => {
  await resetDb()
  clearKnowledgeCache()
  calls = 0
  botMock.fail = null
  await publishChat()
  await saveAi()
  await put("leads", {
    recipients: ["team@example.ie"],
    retentionMonths: 24,
    acknowledgement: false,
  })
  vi.mocked(createLanguageModel).mockReset()
  vi.mocked(createLanguageModel).mockImplementation(() => model())
  sendSpy = vi.spyOn(mailer, "send").mockResolvedValue({ delivered: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("chat sweep", () => {
  it("closes chats idle for 24 h with one ended notice", async () => {
    const idle = await start()
    const fresh = await start()
    await age(idle, 25 * 3600)
    await set(idle, sql`ai_lease_until = now() + interval '1 minute'`)
    await age(fresh, 23 * 3600)
    await set(fresh, sql`needs_human = true`)

    await sweep()
    await sweep()

    const chat = (await repo.findById(idle))!
    expect(chat.status).toBe("closed")
    expect(chat.closedAt).not.toBeNull()
    expect(chat.aiLeaseUntil).toBeNull()
    const ended = (await rows(idle)).filter((m) => m.body === ENDED)
    expect(ended).toHaveLength(1)
    expect(ended[0]).toMatchObject({
      sender: "system",
      senderName: null,
      noticeKind: null,
    })
    // A chat that just ended is neither alerted nor resumed.
    expect(calls).toBe(0)
    expect((await repo.findById(fresh))!.status).toBe("open")
    // The 23 h chat waits for a person: one alert, no auto-close.
    expect(waitingAlerts()).toBe(1)
  })

  it("alerts once per waiting episode after 5 min", async () => {
    const id = await start()
    await set(id, sql`needs_human = true`)
    await age(id, 4 * 60)
    await sweep()
    expect(waitingAlerts()).toBe(0)

    await age(id, 6 * 60)
    await sweep()
    await sweep()
    expect(waitingAlerts()).toBe(1)
    expect((await repo.findById(id))!.noReplyAlertedAt).not.toBeNull()

    // A reply ends the episode; a later visitor message starts a new one.
    await repo.addMessage({
      conversationId: id,
      sender: "staff",
      senderName: "Staff",
      body: "On it",
    })
    await repo.addMessage({
      conversationId: id,
      sender: "visitor",
      senderName: "Visitor",
      body: "Still there?",
    })
    await sweep()
    expect(waitingAlerts()).toBe(1)
    await shift(id, 6 * 60)
    await sweep()
    await sweep()
    expect(waitingAlerts()).toBe(2)
    expect(calls).toBe(0)
  })

  it("does not alert while the bot holds a live lease", async () => {
    const id = await start()
    await age(id, 6 * 60)
    await set(id, sql`ai_lease_until = now() + interval '1 minute'`)
    await sweep()
    expect(waitingAlerts()).toBe(0)
    expect(calls).toBe(0)
    expect((await rows(id)).filter((m) => m.sender === "ai")).toHaveLength(0)
  })

  it("alerts a chat left unanswered after the bot was switched off", async () => {
    await publishChat({}, { enabled: false })
    const free = await start()
    const leased = await start()
    await age(free, 6 * 60)
    await age(leased, 6 * 60)
    // A run cut short when the bot went off may still hold its lease.
    await set(leased, sql`ai_lease_until = now() + interval '1 minute'`)

    await sweep()

    expect(waitingAlerts()).toBe(2)
    expect((await repo.findById(free))!.needsHuman).toBe(false)
    expect(calls).toBe(0)
  })

  it("resumes a bot-owned chat whose visitor spoke >90 s ago with no reply", async () => {
    const stalled = await start()
    const recent = await start()
    const human = await start()
    await age(stalled, 120)
    await age(recent, 60)
    await age(human, 120)
    await set(human, sql`needs_human = true`)

    await sweep()

    const ai = (await rows(stalled)).filter((m) => m.sender === "ai")
    expect(ai).toHaveLength(1)
    expect(ai[0]!.body).toBe("Reply 1")
    expect(calls).toBe(1)
    expect((await rows(recent)).filter((m) => m.sender === "ai")).toHaveLength(
      0
    )
    expect((await rows(human)).filter((m) => m.sender === "ai")).toHaveLength(0)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it("reports failed resumes as the run's warning", async () => {
    const a = await start()
    const b = await start()
    await age(a, 120)
    await age(b, 120)
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    botMock.fail = new TypeError("Hello there from the visitor")

    expect(await sweep()).toEqual({ warning: "2 chat resume(s) failed" })

    expect(errorSpy.mock.calls.map(([line]) => line)).toEqual([
      "[chat] resume failed (TypeError)",
      "[chat] resume failed (TypeError)",
    ])
    expect(calls).toBe(0)
  })

  it("does nothing while chat is off", async () => {
    const idle = await start()
    const waiting = await start()
    await age(idle, 25 * 3600)
    await age(waiting, 6 * 60)

    await publishChat({ enabled: false })
    expect(await sweep()).toEqual({})
    await getDb().delete(settings).where(eq(settings.key, "chat"))
    expect(await sweep()).toEqual({})

    expect((await repo.findById(idle))!.status).toBe("open")
    expect((await rows(idle)).filter((m) => m.body === ENDED)).toHaveLength(0)
    expect((await repo.findById(waiting))!.noReplyAlertedAt).toBeNull()
    expect(sendSpy).not.toHaveBeenCalled()
    expect(calls).toBe(0)
  })
})

describe("chat retention", () => {
  const purgedAudits = () =>
    getDb().select().from(auditLog).where(eq(auditLog.action, "chat.purged"))

  it("purge deletes chats older than retentionMonths and audits the count", async () => {
    await publishChat({ retentionMonths: 3 })
    const old = await start()
    const closedOld = await start()
    const young = await start()
    await set(old, sql`last_message_at = now() - interval '4 months'`)
    // Counted from the close, not the last message.
    await set(
      closedOld,
      sql`status = 'closed', last_message_at = now() - interval '6 months',
          closed_at = now() - interval '5 months'`
    )
    await set(young, sql`last_message_at = now() - interval '2 months'`)

    expect(await purge()).toEqual({})

    expect(await repo.findById(old)).toBeNull()
    expect(await repo.findById(closedOld)).toBeNull()
    expect(await repo.findById(young)).not.toBeNull()
    expect(await rows(old)).toHaveLength(0)
    const audits = await purgedAudits()
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      actorId: null,
      entityType: "chat",
      diff: { count: 2 },
    })

    // Nothing left to purge: no audit row.
    await purge()
    expect(await purgedAudits()).toHaveLength(1)
  })

  it("purges with the default retention while the chat setting is unpublished", async () => {
    await getDb().delete(settings).where(eq(settings.key, "chat"))
    const old = await start()
    const young = await start()
    await set(old, sql`last_message_at = now() - interval '13 months'`)
    await set(young, sql`last_message_at = now() - interval '11 months'`)

    await purge()

    expect(await repo.findById(old)).toBeNull()
    expect(await repo.findById(young)).not.toBeNull()
    expect((await purgedAudits())[0]!.diff).toEqual({ count: 1 })
  })
})
