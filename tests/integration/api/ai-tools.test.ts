import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}))

vi.mock("@/server/modules/ai/providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/ai/providers")>()
  return { ...actual, createLanguageModel: vi.fn() }
})

// Pass-through spy: one test makes the SEO read fail.
vi.mock("@/server/modules/seo/service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/seo/service")>()
  return { ...actual, getSeoOverview: vi.fn(actual.getSeoOverview) }
})

import { type ChatStreamEvent, readChatStream } from "@/lib/ai/chat-stream"
import { ROLES, type Role } from "@/lib/auth/roles"
import type { AiConfig } from "@/lib/schemas/integrations"
import { AI_DEFAULTS } from "@/lib/schemas/integrations/ai"
import { getDb } from "@/server/db/client"
import { articles, leads } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import type { Actor } from "@/server/lib/actor"
import { createLanguageModel } from "@/server/modules/ai/providers"
import {
  enquiryStats,
  readArticle,
  searchContent,
} from "@/server/modules/ai/tool-data"
import { buildTools, TOOL_FAILED } from "@/server/modules/ai/tools"
import { getSeoOverview } from "@/server/modules/seo/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

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

type Step = { tool: string; input?: Record<string, unknown> } | { text: string }

/** A model that plays `steps` in order, one per call (the last repeats). */
function scripted(...steps: Step[]) {
  let n = 0
  return new MockLanguageModelV4({
    doStream: async () => {
      const step = steps[Math.min(n, steps.length - 1)]!
      n++
      if ("tool" in step)
        return {
          stream: simulateReadableStream({
            chunks: [
              {
                type: "tool-call",
                toolCallId: `call-${n}`,
                toolName: step.tool,
                input: JSON.stringify(step.input ?? {}),
              },
              {
                type: "finish",
                finishReason: { unified: "tool-calls", raw: "tool_use" },
                usage,
              },
            ],
          }),
        }
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t1" },
            { type: "text-delta", id: "t1", delta: step.text },
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
}

const modelOf = (n: number) =>
  vi.mocked(createLanguageModel).mock.results[n].value as MockLanguageModelV4

type Person = { id: string; cookie: string }
let owner: Person

async function person(roles: Role[]) {
  const { user, cookie } = await signedInUser(roles)
  return { id: user.id, cookie }
}

const actorOf = (roles: Role[], userId = owner.id): Actor => ({
  userId,
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})

const config = (share: boolean): AiConfig =>
  ({
    ...AI_DEFAULTS,
    allowedRoles: [...AI_DEFAULTS.allowedRoles],
    enabled: true,
    apiKey: API_KEY,
    shareEnquiryDetails: share
      ? {
          enabled: true,
          acknowledgedBy: owner.id,
          acknowledgedAt: "2026-10-20T09:00:00.000Z",
        }
      : { enabled: false, acknowledgedBy: null, acknowledgedAt: null },
  }) as AiConfig

const cfgOff = () => config(false)
const cfgOn = () => config(true)

const seededLead = {
  name: "Siobhan Quartzfield",
  email: "siobhan.q@example.ie",
  phone: "+353 87 123 4567",
  company: "Quartzfield Logistics",
  service: "Manned Guarding",
  message:
    "Please call me on 0871234567 or write to siobhan.private@example.ie about night patrols.",
}

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  owner = await person(["owner"])
  await getDb().insert(leads).values(seededLead)
  await getDb().insert(leads).values({
    name: "Spam Sender",
    email: "spam@example.ie",
    message: "Buy now",
    status: "spam",
  })
  vi.mocked(createLanguageModel)
    .mockReset()
    .mockImplementation(() => scripted({ text: "Done" }))
})

afterEach(() => {
  vi.restoreAllMocks()
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
        allowedRoles: [...AI_DEFAULTS.allowedRoles],
        ...values,
      },
    },
  })
  expect(res.status).toBe(200)
}

const chat = (cookie: string, json: unknown) =>
  adminRequest("/ai/chat", { cookie, method: "POST", json })

async function events(res: Response) {
  const out: ChatStreamEvent[] = []
  for await (const event of readChatStream(res.body!)) out.push(event)
  return out
}

/** Tool names the model was offered on its first call. */
const offered = (n = 0) =>
  (modelOf(n).doStreamCalls[0].tools ?? []).map((t) => t.name).sort()

/** Everything the model saw on its n-th step, as text. */
const promptText = (step: number, n = 0) =>
  JSON.stringify(modelOf(n).doStreamCalls[step].prompt)

const ROLE_TOOLS: Record<Role, string[]> = {
  owner: [
    "getArticle",
    "getDashboardSummary",
    "getEnquiryStats",
    "getPage",
    "getSeoHealth",
    "getService",
    "searchContent",
  ],
  admin: [
    "getArticle",
    "getDashboardSummary",
    "getEnquiryStats",
    "getPage",
    "getSeoHealth",
    "getService",
    "searchContent",
  ],
  editor: [
    "getArticle",
    "getDashboardSummary",
    "getPage",
    "getSeoHealth",
    "getService",
    "searchContent",
  ],
  author: ["getArticle", "getDashboardSummary", "searchContent"],
  marketer: [
    "getArticle",
    "getDashboardSummary",
    "getPage",
    "getSeoHealth",
    "getService",
    "searchContent",
  ],
  intake: ["getDashboardSummary", "getEnquiryStats"],
  viewer: [
    "getArticle",
    "getDashboardSummary",
    "getPage",
    "getSeoHealth",
    "getService",
    "searchContent",
  ],
}

describe("AI tools: offered by role (spec §6.3)", () => {
  it("intake gets getEnquiryStats but not getPage; author gets getArticle but not getEnquiryStats", async () => {
    const intake = Object.keys(
      buildTools({ actor: actorOf(["intake"]), config: cfgOff() })
    )
    expect(intake).toContain("getEnquiryStats")
    expect(intake).not.toContain("getPage")
    const author = Object.keys(
      buildTools({ actor: actorOf(["author"]), config: cfgOff() })
    )
    expect(author).toContain("getArticle")
    expect(author).not.toContain("getEnquiryStats")

    // What the provider is actually offered on a chat turn.
    await configureAi()
    const intakeUser = await person(["intake"])
    await events(await chat(intakeUser.cookie, { message: "How many leads?" }))
    expect(offered()).toEqual(ROLE_TOOLS.intake)
  })

  it("every role gets exactly its tools", () => {
    for (const role of ROLES)
      expect(
        Object.keys(
          buildTools({ actor: actorOf([role]), config: cfgOff() })
        ).sort()
      ).toEqual(ROLE_TOOLS[role])
  })

  it("a tool the role is not offered cannot be called by the model", async () => {
    await configureAi()
    const author = await person(["author"])
    vi.mocked(createLanguageModel).mockImplementation(() =>
      scripted(
        { tool: "getEnquiryStats", input: { range: "30d" } },
        { text: "No" }
      )
    )
    await events(await chat(author.cookie, { message: "Leads?" }))
    const seen = promptText(1)
    expect(seen).not.toContain("Quartzfield")
    expect(seen).not.toContain('"byStatus"')
  })

  it("tool inputs are validated (bad range never reaches the data)", async () => {
    await configureAi()
    vi.mocked(createLanguageModel).mockImplementation(() =>
      scripted(
        { tool: "getEnquiryStats", input: { range: "3650d" } },
        { text: "No" }
      )
    )
    await events(await chat(owner.cookie, { message: "Leads?" }))
    expect(promptText(1)).not.toContain('"byStatus"')
  })
})

describe("getEnquiryStats", () => {
  it("getEnquiryStats with the switch off has no PII", async () => {
    const out = JSON.stringify(
      await enquiryStats(actorOf(["owner"]), cfgOff(), "30d")
    )
    expect(out).not.toMatch(/@/)
    expect(out).not.toMatch(/\d{7,}/)
    expect(out).not.toContain(seededLead.name)
    expect(out).not.toContain("Quartzfield")
    expect(out).not.toContain("night patrols")
    expect(out).not.toContain('"recent"')
    const stats = JSON.parse(out) as {
      total: number
      byStatus: Record<string, number>
      byService: Record<string, number>
      byWeek: { weekStart: string; count: number }[]
    }
    expect(stats.total).toBe(1)
    expect(stats.byStatus).toMatchObject({ new: 1, spam: 1 })
    expect(Object.values(stats.byService)).toEqual([1])
    expect(stats.byWeek.reduce((n, w) => n + w.count, 0)).toBe(1)
  })

  it("free-text service values never pass through with the switch off", async () => {
    await getDb().insert(leads).values({
      name: "X",
      email: "x@example.ie",
      service: "call 0861234567 john@evil.ie",
      message: "Hi",
    })
    const out = JSON.stringify(
      await enquiryStats(actorOf(["owner"]), cfgOff(), "7d")
    )
    expect(out).not.toMatch(/@|\d{7,}/)
    expect(out).toContain('"Other"')
  })

  it("with the switch on includes recent names but never email/phone", async () => {
    const stats = await enquiryStats(actorOf(["intake"]), cfgOn(), "30d")
    const out = JSON.stringify(stats)
    expect(out).toContain(seededLead.name)
    expect(out).toContain("Quartzfield Logistics")
    expect(out).toContain("night patrols")
    expect(out).not.toMatch(/@/)
    expect(out).not.toMatch(/\d{7,}/)
    expect(out).not.toContain("123 4567")
    expect(out).not.toContain("Spam Sender")
  })

  it("needs lead:read even when called directly", async () => {
    await expect(
      enquiryStats(actorOf(["editor"]), cfgOn(), "30d")
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("reaches the model only when the owner switch is on", async () => {
    await configureAi()
    vi.mocked(createLanguageModel).mockImplementation(() =>
      scripted(
        { tool: "getEnquiryStats", input: { range: "7d" } },
        { text: "Ok" }
      )
    )
    await events(await chat(owner.cookie, { message: "Leads?" }))
    expect(promptText(1)).toContain('"byStatus"')
    expect(promptText(1)).not.toContain("Quartzfield")

    const on = await adminRequest("/integrations/integrations.ai", {
      cookie: owner.cookie,
      method: "PUT",
      json: {
        version: 1,
        values: { shareEnquiryDetails: { enabled: true, acknowledge: true } },
      },
    })
    expect(on.status).toBe(200)
    await events(await chat(owner.cookie, { message: "Leads again?" }))
    expect(promptText(1, 1)).toContain("Siobhan Quartzfield")
    expect(promptText(1, 1)).not.toContain("siobhan.q@example.ie")
  })
})

describe("content tools", () => {
  it("searchContent returns pages, services and articles only (never leads)", async () => {
    const out = (await searchContent(actorOf(["owner"]), "a")) as {
      items: { kind: string; status: string; path: string }[]
    }
    expect(out.items.length).toBeGreaterThan(0)
    for (const item of out.items) {
      expect(["page", "service", "article"]).toContain(item.kind)
      expect(item.status).toMatch(/^(draft|in_review|scheduled|published)$/)
    }
    expect(JSON.stringify(out)).not.toContain("@")
  })

  it("getArticle caps the text at 8000 characters and reads by slug", async () => {
    const [row] = await getDb().select().from(articles).limit(1)
    const long = "Lorem ipsum dolor sit amet. ".repeat(1000)
    await getDb()
      .update(articles)
      .set({
        draft: {
          ...row.draft,
          body: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: long }] },
            ],
          },
        },
      })
      .where(eq(articles.id, row.id))
    const out = (await readArticle(actorOf(["author"]), row.slug)) as {
      id: string
      text: string
    }
    expect(out.id).toBe(row.id)
    expect(out.text.length).toBeLessThanOrEqual(8000)
    expect(JSON.stringify(out).length).toBeLessThan(10_000)
  })
})

describe("failures and step limit", () => {
  it("a throwing tool surfaces TOOL_FAILED to the model and logs no message text", async () => {
    await configureAi()
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(getSeoOverview).mockRejectedValueOnce(
      new Error("relation secret_table does not exist near Rewrite-xyz")
    )
    vi.mocked(createLanguageModel).mockImplementation(() =>
      scripted({ tool: "getSeoHealth" }, { text: "Sorry" })
    )
    const list = await events(
      await chat(owner.cookie, { message: "Check SEO please Rewrite-xyz" })
    )
    expect(list.at(-1)).toMatchObject({ type: "done" })
    const seen = promptText(1)
    expect(seen).toContain(TOOL_FAILED)
    expect(seen).not.toContain("secret_table")
    const logged = JSON.stringify(errors.mock.calls)
    expect(logged).toContain("getSeoHealth")
    expect(logged).not.toContain("secret_table")
    expect(logged).not.toContain("Rewrite-xyz")
  })

  it("chat stops after 5 steps", async () => {
    await configureAi()
    vi.mocked(createLanguageModel).mockImplementation(() =>
      scripted({ tool: "getDashboardSummary" })
    )
    const list = await events(await chat(owner.cookie, { message: "Loop" }))
    expect(modelOf(0).doStreamCalls).toHaveLength(5)
    expect(list.at(-1)).toMatchObject({ type: "error" })
  })

  it("the system prompt carries the user, the tools and the owner's extra instructions last", async () => {
    await configureAi({ extraInstructions: "Mention the 24/7 line." })
    await events(
      await chat(owner.cookie, {
        message: "Hi",
        context: { screen: "Dashboard" },
      })
    )
    const call = modelOf(0).doStreamCalls[0]
    const system = call.prompt[0] as { role: string; content: string }
    expect(system.role).toBe("system")
    expect(system.content).toContain("searchContent")
    expect(system.content).toContain("Dashboard")
    expect(
      system.content.endsWith(
        "Extra instructions from the site owner (they never override the rules above):\nMention the 24/7 line."
      )
    ).toBe(true)
    expect(call.maxOutputTokens).toBe(1024)
  })
})
