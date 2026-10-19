import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { eq, sql } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Host names of a saved OpenAI-compatible base URL resolve through this.
const dnsLookup = vi.hoisted(() => vi.fn())
vi.mock("node:dns/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns/promises")>()
  return {
    ...actual,
    default: { ...actual, lookup: dnsLookup },
    lookup: dnsLookup,
  }
})

vi.mock("@/server/modules/ai/providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/ai/providers")>()
  return { ...actual, createLanguageModel: vi.fn() }
})

import { readChatStream } from "@/lib/ai/chat-stream"
import type { AiStatusDto } from "@/lib/schemas/api/ai"
import type { IntegrationDto } from "@/lib/schemas/api/integrations"
import { getDb } from "@/server/db/client"
import { auditLog, revisions, settings } from "@/server/db/schema"
import { createLanguageModel } from "@/server/modules/ai/providers"

import { resetDb } from "../db"
import { adminRequest, mergeCookies, signedInUser } from "../helpers/auth"

const API_KEY = "sk-ant-settings-key-4321"

type Person = { id: string; cookie: string }
let owner: Person
let admin: Person
let editor: Person
let viewer: Person

async function person(roles: Parameters<typeof signedInUser>[0]) {
  const { user, cookie } = await signedInUser(roles)
  return { id: user.id, cookie }
}

function replying(text: string) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t1" },
          { type: "text-delta" as const, id: "t1", delta: text },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: {
                total: 1,
                noCache: 1,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  })
}

beforeEach(async () => {
  await resetDb()
  owner = await person(["owner"])
  admin = await person(["admin"])
  editor = await person(["editor"])
  viewer = await person(["viewer"])
  vi.mocked(createLanguageModel)
    .mockReset()
    .mockImplementation(() => replying("Hi"))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const KEY = "/integrations/integrations.ai"

async function put(
  who: Person,
  version: number,
  values: Record<string, unknown>
) {
  const res = await adminRequest(KEY, {
    cookie: who.cookie,
    method: "PUT",
    json: { version, values },
  })
  return { status: res.status, body: (await res.json()) as unknown }
}

const dto = (body: unknown) => body as IntegrationDto
const fieldErrors = (body: unknown) =>
  (body as { error: { fieldErrors?: Record<string, string[]> } }).error
    .fieldErrors ?? {}
const errorMessage = (body: unknown) =>
  (body as { error: { message: string } }).error.message

const base = {
  enabled: false,
  provider: "anthropic",
  model: "claude-sonnet-5-5",
  apiKey: API_KEY,
  allowedRoles: ["owner", "admin", "editor"],
}

const status = async (who: Person) =>
  (await (
    await adminRequest("/ai/status", { cookie: who.cookie })
  ).json()) as AiStatusDto

describe("GET /ai/status (manager fields)", () => {
  it("status for an owner on a fresh DB: available false, canManage true, reason unconfigured", async () => {
    expect(await status(owner)).toEqual({
      available: false,
      canManage: true,
      reason: "unconfigured",
      model: null,
      readOnly: false,
    })
  })

  it("status for an editor on a fresh DB: canManage false", async () => {
    expect(await status(editor)).toMatchObject({
      available: false,
      canManage: false,
      reason: "unconfigured",
    })
    expect(await status(viewer)).toMatchObject({
      available: false,
      canManage: false,
      reason: "not-allowed",
    })
  })

  it("reason off when saved but off; not-allowed outside the role list; null when on", async () => {
    await put(owner, 0, { ...base, allowedRoles: ["owner"] })
    expect(await status(owner)).toMatchObject({
      available: false,
      reason: "off",
    })
    await put(owner, 1, { enabled: true })
    expect(await status(owner)).toEqual({
      available: true,
      canManage: true,
      reason: null,
      model: "claude-sonnet-5-5",
      readOnly: false,
    })
    expect(await status(admin)).toEqual({
      available: false,
      canManage: true,
      reason: "not-allowed",
      model: null,
      readOnly: false,
    })
  })
})

describe("PUT integrations.ai (MK fields)", () => {
  it("a fresh form has the MK defaults", async () => {
    const res = await adminRequest(KEY, { cookie: owner.cookie })
    expect(dto(await res.json()).values).toMatchObject({
      baseUrl: "",
      extraInstructions: "",
      maxOutputTokens: 1024,
      shareEnquiryDetails: {
        enabled: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
      },
    })
  })

  it("admin cannot enable shareEnquiryDetails (403); owner without acknowledge → 422; owner with → stored with acknowledgedBy", async () => {
    expect((await put(owner, 0, base)).status).toBe(200)

    const byAdmin = await put(admin, 1, {
      shareEnquiryDetails: { enabled: true, acknowledge: true },
    })
    expect(byAdmin.status).toBe(403)

    const unacknowledged = await put(owner, 1, {
      shareEnquiryDetails: { enabled: true },
    })
    expect(unacknowledged.status).toBe(422)
    expect(errorMessage(unacknowledged.body)).toBe(
      "Confirm the acknowledgement first"
    )

    const before = Date.now()
    const ok = await put(owner, 1, {
      shareEnquiryDetails: { enabled: true, acknowledge: true },
    })
    expect(ok.status).toBe(200)
    const share = dto(ok.body).values.shareEnquiryDetails as {
      enabled: boolean
      acknowledgedBy: string | null
      acknowledgedAt: string | null
    }
    expect(share).toEqual({
      enabled: true,
      acknowledgedBy: owner.id,
      acknowledgedAt: expect.any(String),
    })
    expect(Date.parse(share.acknowledgedAt!)).toBeGreaterThanOrEqual(
      before - 1000
    )

    // An admin saving the rest of the form keeps the owner's switch as it is.
    const resave = await put(admin, 2, {
      model: "claude-opus-5-5",
      shareEnquiryDetails: { enabled: true },
    })
    expect(resave.status).toBe(200)
    expect(dto(resave.body).values.shareEnquiryDetails).toEqual(share)

    // Turning it off is allowed to an admin and clears the stamp.
    const off = await put(admin, 3, {
      shareEnquiryDetails: { enabled: false },
    })
    expect(off.status).toBe(200)
    expect(dto(off.body).values.shareEnquiryDetails).toEqual({
      enabled: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
    })
    const [row] = await getDb()
      .select({ draft: settings.draft })
      .from(settings)
      .where(eq(settings.key, "integrations.ai"))
    expect(JSON.stringify(row.draft)).not.toContain('acknowledge"')
  })

  it("an owner cannot turn enquiry sharing on while viewing as another owner (403)", async () => {
    expect((await put(owner, 0, base)).status).toBe(200)
    const other = await person(["owner"])
    const start = await adminRequest(`/users/${other.id}/impersonate`, {
      cookie: owner.cookie,
      method: "POST",
    })
    expect(start.status).toBe(200)
    const asOther = { id: other.id, cookie: mergeCookies(owner.cookie, start) }
    const refused = await put(asOther, 1, {
      shareEnquiryDetails: { enabled: true, acknowledge: true },
    })
    expect(refused.status).toBe(403)
    // The refusal is the switch, not the save: the same person may save the rest.
    expect((await put(asOther, 1, { model: "claude-opus-5-5" })).status).toBe(
      200
    )
    const res = await adminRequest(KEY, { cookie: owner.cookie })
    expect(dto(await res.json()).values.shareEnquiryDetails).toMatchObject({
      enabled: false,
    })
  })

  it("a new provider or base URL resets the owner's acknowledgement", async () => {
    const OFF = { enabled: false, acknowledgedBy: null, acknowledgedAt: null }
    const turnOn = { shareEnquiryDetails: { enabled: true, acknowledge: true } }
    expect((await put(owner, 0, base)).status).toBe(200)
    expect((await put(owner, 1, turnOn)).status).toBe(200)

    // An admin moves the assistant to another provider with their own key:
    // the form re-sends the switch as it was, but it is off afterwards.
    const moved = await put(admin, 2, {
      provider: "openai",
      model: "gpt-5",
      apiKey: "sk-admin-own-key-123456",
      shareEnquiryDetails: { enabled: true },
    })
    expect(moved.status).toBe(200)
    expect(dto(moved.body).values.shareEnquiryDetails).toEqual(OFF)

    // OpenAI-compatible: another base URL resets it too.
    const compat = await put(owner, 3, {
      provider: "openai-compatible",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama",
      apiKey: "gsk-key-1234567890",
      ...turnOn,
    })
    expect(compat.status).toBe(200)
    // The owner re-acknowledged in the same save: on, stamped for the new target.
    expect(dto(compat.body).values.shareEnquiryDetails).toMatchObject({
      enabled: true,
      acknowledgedBy: owner.id,
    })
    const otherUrl = await put(admin, 4, {
      baseUrl: "https://api.together.xyz/v1",
      apiKey: "tg-key-1234567890",
      shareEnquiryDetails: { enabled: true },
    })
    expect(otherUrl.status).toBe(200)
    expect(dto(otherUrl.body).values.shareEnquiryDetails).toEqual(OFF)

    // An admin cannot re-acknowledge for the new target.
    expect((await put(admin, 5, turnOn)).status).toBe(403)

    // Same provider and base URL: the switch is kept (no reset).
    expect((await put(owner, 5, turnOn)).status).toBe(200)
    const same = await put(admin, 6, {
      baseUrl: "https://api.together.xyz/v1/",
      model: "llama-2",
      shareEnquiryDetails: { enabled: true },
    })
    expect(same.status).toBe(200)
    expect(dto(same.body).values.shareEnquiryDetails).toMatchObject({
      enabled: true,
      acknowledgedBy: owner.id,
    })
  })

  it("an invalid shareEnquiryDetails input → 422", async () => {
    const bad = await put(owner, 0, {
      ...base,
      shareEnquiryDetails: { enabled: "yes" },
    })
    expect(bad.status).toBe(422)
    expect(fieldErrors(bad.body)).toHaveProperty("shareEnquiryDetails")
    const forged = await put(owner, 0, {
      ...base,
      shareEnquiryDetails: {
        enabled: false,
        acknowledgedBy: owner.id,
        acknowledgedAt: "2020-01-01T00:00:00.000Z",
      },
    })
    expect(forged.status).toBe(422)
  })

  it("changing provider drops the saved key (secret set:false afterwards)", async () => {
    expect((await put(owner, 0, base)).status).toBe(200)
    const moved = await put(owner, 1, { provider: "openai", model: "gpt-5" })
    expect(moved.status).toBe(200)
    expect(dto(moved.body).secrets.apiKey).toEqual({ set: false, hint: null })

    // A new key entered with the change is kept.
    const rekeyed = await put(owner, 2, {
      provider: "google",
      model: "gemini-2.5-flash",
      apiKey: "google-api-key-123456",
    })
    expect(rekeyed.status).toBe(200)
    expect(dto(rekeyed.body).secrets.apiKey.set).toBe(true)

    // Pointing an OpenAI-compatible provider at another base URL drops it too.
    const compat = await put(owner, 3, {
      provider: "openai-compatible",
      baseUrl: "https://api.groq.com/openai/v1/",
      model: "llama-3.3-70b",
      apiKey: "gsk-key-1234567890",
    })
    expect(compat.status).toBe(200)
    expect(dto(compat.body).values.baseUrl).toBe(
      "https://api.groq.com/openai/v1"
    )
    expect(dto(compat.body).secrets.apiKey.set).toBe(true)
    const sameUrl = await put(owner, 4, {
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.1-8b",
    })
    expect(dto(sameUrl.body).secrets.apiKey.set).toBe(true)
    const otherUrl = await put(owner, 5, {
      baseUrl: "https://api.together.xyz/v1",
    })
    expect(otherUrl.status).toBe(200)
    expect(dto(otherUrl.body).secrets.apiKey.set).toBe(false)
  })

  it("an enabled assistant must have its key entered again for a new provider", async () => {
    await put(owner, 0, { ...base, enabled: true })
    const moved = await put(owner, 1, { provider: "openai", model: "gpt-5" })
    expect(moved.status).toBe(422)
    expect(fieldErrors(moved.body)).toEqual({
      apiKey: ["Enter the API key again for the new provider"],
    })
  })

  it("Remove key: clearSecrets drops the saved key (owner and admin), audited by name", async () => {
    expect((await put(owner, 0, base)).status).toBe(200)
    const res = await adminRequest(KEY, {
      cookie: admin.cookie,
      method: "PUT",
      json: { version: 1, values: {}, clearSecrets: ["apiKey"] },
    })
    expect(res.status).toBe(200)
    const body = dto(await res.json())
    expect(body.secrets.apiKey).toEqual({ set: false, hint: null })
    expect(body.values.model).toBe("claude-sonnet-5-5")
    const [row] = await getDb()
      .select({ draft: settings.draft })
      .from(settings)
      .where(eq(settings.key, "integrations.ai"))
    expect((row.draft as Record<string, unknown>).apiKey).toBe("")
    const audits = await getDb()
      .select({ action: auditLog.action, diff: auditLog.diff })
      .from(auditLog)
      .where(eq(auditLog.entityId, "integrations.ai"))
      .orderBy(auditLog.createdAt)
    expect(audits.at(-1)).toEqual({
      action: "integration.updated",
      diff: { changed: ["apiKey"] },
    })
    expect(JSON.stringify(audits)).not.toContain(API_KEY)
  })

  it("Remove key: refused for an editor, while on, for a non-secret, or with a new key", async () => {
    expect((await put(owner, 0, { ...base, enabled: true })).status).toBe(200)
    const clear = (
      who: Person,
      values: Record<string, unknown>,
      fields: string[]
    ) =>
      adminRequest(KEY, {
        cookie: who.cookie,
        method: "PUT",
        json: { version: 1, values, clearSecrets: fields },
      })
    expect((await clear(editor, {}, ["apiKey"])).status).toBe(403)
    const whileOn = await clear(owner, {}, ["apiKey"])
    expect(whileOn.status).toBe(422)
    expect(fieldErrors(await whileOn.json())).toHaveProperty("apiKey")
    const notSecret = await clear(owner, { enabled: false }, ["model"])
    expect(notSecret.status).toBe(422)
    const both = await clear(
      owner,
      { enabled: false, apiKey: "sk-ant-new-key-99999" },
      ["apiKey"]
    )
    expect(both.status).toBe(422)
    expect(fieldErrors(await both.json())).toHaveProperty("apiKey")
    // Nothing above changed the saved key.
    const after = dto(
      await (await adminRequest(KEY, { cookie: owner.cookie })).json()
    )
    expect(after.version).toBe(1)
    expect(after.secrets.apiKey.set).toBe(true)
  })

  it("maxOutputTokens 9000 → 422", async () => {
    const over = await put(owner, 0, { ...base, maxOutputTokens: 9000 })
    expect(over.status).toBe(422)
    expect(fieldErrors(over.body)).toHaveProperty("maxOutputTokens")
    expect((await put(owner, 0, { ...base, maxOutputTokens: 63 })).status).toBe(
      422
    )
    const ok = await put(owner, 0, { ...base, maxOutputTokens: 8192 })
    expect(ok.status).toBe(200)
    expect(dto(ok.body).values.maxOutputTokens).toBe(8192)
  })

  it("extra instructions are capped at 2000 characters", async () => {
    const over = await put(owner, 0, {
      ...base,
      extraInstructions: "x".repeat(2001),
    })
    expect(over.status).toBe(422)
    expect(fieldErrors(over.body)).toHaveProperty("extraInstructions")
  })

  it("the base URL is required for OpenAI-compatible and SSRF-guarded; ignored for others", async () => {
    const missing = await put(owner, 0, {
      ...base,
      provider: "openai-compatible",
      model: "m",
    })
    expect(missing.status).toBe(422)
    expect(fieldErrors(missing.body)).toHaveProperty("baseUrl")
    for (const url of [
      "https://10.0.0.1/v1",
      "http://api.x.com/v1",
      "https://169.254.169.254",
    ]) {
      const blocked = await put(owner, 0, {
        ...base,
        provider: "openai-compatible",
        model: "m",
        baseUrl: url,
      })
      expect(blocked.status).toBe(422)
      expect(fieldErrors(blocked.body)).toHaveProperty("baseUrl")
    }
    const other = await put(owner, 0, {
      ...base,
      baseUrl: "https://10.0.0.1/v1",
    })
    expect(other.status).toBe(200)
    expect(dto(other.body).values.baseUrl).toBe("")
  })
})

describe("chat uses the saved maxOutputTokens", () => {
  it("passes config.maxOutputTokens to the model", async () => {
    await put(owner, 0, { ...base, enabled: true, maxOutputTokens: 300 })
    const res = await adminRequest("/ai/chat", {
      cookie: owner.cookie,
      method: "POST",
      json: { message: "Hello" },
    })
    expect(res.status).toBe(200)
    for await (const _ of readChatStream(res.body!)) void _
    const model = vi.mocked(createLanguageModel).mock.results[0]
      .value as MockLanguageModelV4
    expect(model.doStreamCalls[0].maxOutputTokens).toBe(300)
  })
})

describe("POST /ai/models", () => {
  const models = (who: Person, json: unknown) =>
    adminRequest("/ai/models", { cookie: who.cookie, method: "POST", json })

  it("needs integration:update", async () => {
    expect(
      (await models(editor, { provider: "anthropic", baseUrl: "" })).status
    ).toBe(403)
  })

  it("lists the saved provider's models with the saved key", async () => {
    await put(owner, 0, base)
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [{ id: "claude-sonnet-5-5" }, { id: "claude-haiku-5-5" }],
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const res = await models(admin, { provider: "anthropic", baseUrl: "" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      models: ["claude-haiku-5-5", "claude-sonnet-5-5"],
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/models/)
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(API_KEY)
  })

  it("never sends the saved key to another provider or base URL", async () => {
    await put(owner, 0, base)
    const fetchMock = vi.fn(async () => Response.json({ data: [] }))
    vi.stubGlobal("fetch", fetchMock)
    const other = await models(owner, { provider: "openai", baseUrl: "" })
    expect(other.status).toBe(422)
    const compat = await models(owner, {
      provider: "openai-compatible",
      baseUrl: "https://evil.example.com/v1",
    })
    expect(compat.status).toBe(422)
    const blocked = await models(owner, {
      provider: "openai-compatible",
      baseUrl: "https://10.0.0.1/v1",
    })
    expect(blocked.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("masks provider errors and needs a saved key", async () => {
    expect(
      (await models(owner, { provider: "anthropic", baseUrl: "" })).status
    ).toBe(422)
    await put(owner, 0, base)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: `bad key ${API_KEY}` }, { status: 401 })
      )
    )
    const res = await models(owner, { provider: "anthropic", baseUrl: "" })
    expect(res.status).toBe(422)
    const text = await res.text()
    expect(text).toContain("The API key was rejected.")
    expect(text).not.toContain(API_KEY)
  })

  it("refuses a saved base URL whose host resolves to a private address", async () => {
    await put(owner, 0, {
      ...base,
      provider: "openai-compatible",
      baseUrl: "https://llm.rebind.example/v1",
      model: "llama",
      apiKey: "gsk-key-1234567890",
    })
    dnsLookup.mockResolvedValue([{ address: "10.0.0.7", family: 4 }])
    const res = await models(owner, {
      provider: "openai-compatible",
      baseUrl: "https://llm.rebind.example/v1",
    })
    expect(res.status).toBe(422)
    const text = await res.text()
    expect(text).toContain("This address is not allowed")
    expect(text).not.toContain("gsk-key-1234567890")
    expect(dnsLookup).toHaveBeenCalledWith("llm.rebind.example", {
      all: true,
      verbatim: true,
    })

    // "Test connection" uses the same guard.
    const tested = await adminRequest(`${KEY}/test`, {
      cookie: owner.cookie,
      method: "POST",
    })
    expect(JSON.stringify(await tested.json())).toContain(
      "The base URL is not allowed."
    )
  })

  it("stored settings that no longer validate get a neutral message", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "integrations.ai",
        draft: { ...base, apiKey: "", maxOutputTokens: 99_999 },
        version: 1,
      })
    const res = await models(owner, { provider: "anthropic", baseUrl: "" })
    expect(res.status).toBe(422)
    const text = await res.text()
    expect(text).toContain("The saved settings can't be used.")
    expect(text).not.toContain("can no longer be read")
  })

  it("is rate-limited to 10 a minute per user", async () => {
    await put(owner, 0, base)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ id: "m" }] }))
    )
    for (let i = 0; i < 10; i++)
      expect(
        (await models(owner, { provider: "anthropic", baseUrl: "" })).status
      ).toBe(200)
    expect(
      (await models(owner, { provider: "anthropic", baseUrl: "" })).status
    ).toBe(429)
  })
})

describe("migration NNNN_ai_settings", () => {
  const DIR = "server/db/migrations"
  const file = readdirSync(DIR).find((f) => /^\d{4}_ai_settings\.sql$/.test(f))
  const statements = file
    ? readFileSync(join(DIR, file), "utf8")
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const migrate = async () => {
    for (const statement of statements)
      await getDb().execute(sql.raw(statement))
  }

  it("migration 0011 backfills an existing row without touching apiKey", async () => {
    expect(file).toBeDefined()
    const old = {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      apiKey: "v1:ciphertext-stays-as-is",
      allowedRoles: ["owner"],
      maxOutputTokens: 2000,
    }
    await getDb()
      .insert(settings)
      .values({ key: "integrations.ai", draft: old, version: 3 })
    await migrate()
    await migrate()
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "integrations.ai"))
    expect(row.draft).toEqual({
      ...old,
      baseUrl: "",
      extraInstructions: "",
      shareEnquiryDetails: {
        enabled: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
      },
    })
    expect(row.version).toBe(3)
    expect(await getDb().select().from(revisions)).toEqual([])
  })

  it("adds no row when the assistant was never configured", async () => {
    expect(file).toBeDefined()
    await migrate()
    expect(
      await getDb()
        .select()
        .from(settings)
        .where(eq(settings.key, "integrations.ai"))
    ).toEqual([])
  })
})
