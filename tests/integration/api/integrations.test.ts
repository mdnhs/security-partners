import { S3Client } from "@aws-sdk/client-s3"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
  IntegrationDto,
  IntegrationTestResult,
} from "@/lib/schemas/api/integrations"
import { getDb } from "@/server/db/client"
import { auditLog, media, revisions, settings } from "@/server/db/schema"
import { decryptSecret, encryptSecret } from "@/server/lib/crypto"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const SMTP_PASSWORD = "smtp-password-5678"
const R2_SECRET = "r2-secret-access-key-0000"

let owner: string
let admin: string
let editor: string
let viewer: string

beforeEach(async () => {
  await resetDb()
  owner = (await signedInUser(["owner"])).cookie
  admin = (await signedInUser(["admin"])).cookie
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const smtpValues = (overrides: Record<string, unknown> = {}) => ({
  host: "127.0.0.1",
  port: 1025,
  secure: false,
  user: "mailer@example.test",
  password: SMTP_PASSWORD,
  fromName: "Security Partners",
  fromAddress: "no-reply@example.test",
  ...overrides,
})

async function put(
  cookie: string,
  key: string,
  version: number,
  values: Record<string, unknown>
) {
  const res = await adminRequest(`/integrations/${key}`, {
    cookie,
    method: "PUT",
    json: { version, values },
  })
  return { status: res.status, text: await res.text() }
}
const dto = (text: string) => JSON.parse(text) as IntegrationDto

async function rawDraft(key: string) {
  const [row] = await getDb()
    .select({ draft: settings.draft, version: settings.version })
    .from(settings)
    .where(eq(settings.key, key))
  return row
}

describe("GET /api/v1/admin/integrations (owner/admin only)", () => {
  it("lists the four integrations, unconfigured, with defaults", async () => {
    const res = await adminRequest("/integrations", { cookie: owner })
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as { items: IntegrationDto[] }
    expect(items.map((i) => i.key)).toEqual([
      "integrations.smtp",
      "integrations.r2",
      "integrations.turnstile",
      "integrations.ai",
    ])
    const smtp = items[0]
    expect(smtp).toMatchObject({
      slug: "smtp",
      configured: false,
      version: 0,
      updatedAt: null,
      secrets: { password: { set: false, hint: null } },
    })
    expect(smtp.values).toMatchObject({ port: 587, secure: false })
    expect(smtp.values).not.toHaveProperty("password")
  })

  it("admin may read; editor and viewer may not", async () => {
    expect(
      (await adminRequest("/integrations", { cookie: admin })).status
    ).toBe(200)
    expect(
      (await adminRequest("/integrations", { cookie: editor })).status
    ).toBe(403)
    expect(
      (
        await adminRequest("/integrations/integrations.smtp", {
          cookie: viewer,
        })
      ).status
    ).toBe(403)
    expect(
      (await adminRequest("/integrations/integrations.nope", { cookie: owner }))
        .status
    ).toBe(422)
  })
})

describe("PUT /api/v1/admin/integrations/:key", () => {
  it("encrypts secrets at rest and returns only { set, hint }", async () => {
    const { status, text } = await put(
      owner,
      "integrations.smtp",
      0,
      smtpValues()
    )
    expect(status).toBe(200)
    expect(text).not.toContain(SMTP_PASSWORD)
    const body = dto(text)
    expect(body).toMatchObject({
      configured: true,
      version: 1,
      secrets: { password: { set: true, hint: "••••5678" } },
    })
    expect(body.values).toMatchObject({ host: "127.0.0.1", port: 1025 })

    const row = await rawDraft("integrations.smtp")
    expect(JSON.stringify(row.draft)).not.toContain(SMTP_PASSWORD)
    const stored = row.draft as Record<string, string>
    expect(stored.password).toMatch(/^v1:/)
    expect(stored.host).toBe("127.0.0.1")
    expect(decryptSecret(stored.password, "integrations.smtp.password")).toBe(
      SMTP_PASSWORD
    )
    // AAD binds the ciphertext to its key + field.
    expect(() =>
      decryptSecret(stored.password, "integrations.r2.secretAccessKey")
    ).toThrow()
  })

  it("an empty secret keeps the stored value", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const before = (await rawDraft("integrations.smtp")).draft as Record<
      string,
      string
    >
    const { status, text } = await put(
      admin,
      "integrations.smtp",
      1,
      smtpValues({ fromName: "SP Mailer", password: "" })
    )
    expect(status).toBe(200)
    expect(dto(text)).toMatchObject({
      version: 2,
      values: { fromName: "SP Mailer" },
      secrets: { password: { set: true, hint: "••••5678" } },
    })
    const after = (await rawDraft("integrations.smtp")).draft as Record<
      string,
      string
    >
    expect(after.password).toBe(before.password)
    expect(await readIntegrationConfig("integrations.smtp")).toMatchObject({
      fromName: "SP Mailer",
      password: SMTP_PASSWORD,
    })
  })

  it("a new server with the stored password kept → 422 (no exfiltration by retargeting)", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const before = (await rawDraft("integrations.smtp")).draft
    const moved = await put(
      admin,
      "integrations.smtp",
      1,
      smtpValues({ host: "smtp.attacker.test", password: "" })
    )
    expect(moved.status).toBe(422)
    const { error } = JSON.parse(moved.text) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(error.fieldErrors).toEqual({
      password: ["Enter the password again for the new server"],
    })
    expect((await rawDraft("integrations.smtp")).draft).toEqual(before)

    const reentered = await put(
      admin,
      "integrations.smtp",
      1,
      smtpValues({ host: "smtp.example.test", password: "new-password-9999" })
    )
    expect(reentered.status).toBe(200)
    expect(dto(reentered.text)).toMatchObject({
      version: 2,
      values: { host: "smtp.example.test" },
      secrets: { password: { set: true, hint: "••••9999" } },
    })
  })

  it("R2: a new account needs both keys again; AI: a new provider needs the key again", async () => {
    await put(owner, "integrations.r2", 0, {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "default",
      bucket: "sp-media",
      accessKeyId: "AKIDEXAMPLE1234",
      secretAccessKey: R2_SECRET,
    })
    const r2 = await put(owner, "integrations.r2", 1, {
      jurisdiction: "eu",
      accessKeyId: "",
      secretAccessKey: "",
    })
    expect(r2.status).toBe(422)
    expect(
      Object.keys(
        (JSON.parse(r2.text) as { error: { fieldErrors: object } }).error
          .fieldErrors
      ).sort()
    ).toEqual(["accessKeyId", "secretAccessKey"])
    // A new bucket is a new target too: the keys must be entered again.
    const bucket = await put(owner, "integrations.r2", 1, {
      bucket: "sp-media-2",
    })
    expect(bucket.status).toBe(422)
    expect(
      Object.keys(
        (JSON.parse(bucket.text) as { error: { fieldErrors: object } }).error
          .fieldErrors
      ).sort()
    ).toEqual(["accessKeyId", "secretAccessKey"])
    // Rotating the keys for the same bucket needs nothing else.
    expect(
      (
        await put(owner, "integrations.r2", 1, {
          accessKeyId: "AKIDROTATED5678",
          secretAccessKey: "r2-secret-access-key-1111",
        })
      ).status
    ).toBe(200)

    await put(owner, "integrations.ai", 0, {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKey: "sk-ant-secret-key",
      allowedRoles: ["owner"],
    })
    const ai = await put(owner, "integrations.ai", 1, {
      provider: "openai",
      model: "gpt-5",
    })
    expect(ai.status).toBe(422)
    expect(
      (JSON.parse(ai.text) as { error: { fieldErrors: object } }).error
        .fieldErrors
    ).toEqual({ apiKey: ["Enter the API key again for the new provider"] })
  })

  it("SMTP without a user name keeps no password", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const { status, text } = await put(
      owner,
      "integrations.smtp",
      1,
      smtpValues({ user: "", password: "" })
    )
    expect(status).toBe(200)
    expect(dto(text).secrets.password).toEqual({ set: false, hint: null })
  })

  it("a changed secret is re-encrypted and replaces the old ciphertext", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const before = (await rawDraft("integrations.smtp")).draft as Record<
      string,
      string
    >
    await put(
      owner,
      "integrations.smtp",
      1,
      smtpValues({ password: "rotated-password-4321" })
    )
    const after = (await rawDraft("integrations.smtp")).draft as Record<
      string,
      string
    >
    expect(after.password).not.toBe(before.password)
    expect(decryptSecret(after.password, "integrations.smtp.password")).toBe(
      "rotated-password-4321"
    )
    expect(JSON.stringify(after)).not.toContain("rotated-password-4321")
  })

  it("production: an SMTP host on loopback / metadata → 422", async () => {
    vi.stubEnv("NODE_ENV", "production")
    try {
      for (const host of ["127.0.0.1", "169.254.169.254", "localhost"]) {
        const res = await put(
          owner,
          "integrations.smtp",
          0,
          smtpValues({ host })
        )
        expect(res.status).toBe(422)
        expect(
          Object.keys(
            (JSON.parse(res.text) as { error: { fieldErrors: object } }).error
              .fieldErrors
          )
        ).toEqual(["host"])
      }
      // RFC 1918 relays stay allowed.
      expect(
        (
          await put(
            owner,
            "integrations.smtp",
            0,
            smtpValues({ host: "10.0.0.25" })
          )
        ).status
      ).toBe(200)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it("stale version → 409 with the current state, before validation", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const stale = await put(owner, "integrations.smtp", 0, { port: "nope" })
    expect(stale.status).toBe(409)
    const body = JSON.parse(stale.text) as {
      error: { code: string; current: IntegrationDto }
    }
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.current.version).toBe(1)
    expect(stale.text).not.toContain(SMTP_PASSWORD)
  })

  it("invalid values → 422 with field errors; nothing stored", async () => {
    const bad = await put(
      owner,
      "integrations.smtp",
      0,
      smtpValues({ port: 0, password: "" })
    )
    expect(bad.status).toBe(422)
    const { error } = JSON.parse(bad.text) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(error.fieldErrors).sort()).toEqual(["password", "port"])
    expect(await rawDraft("integrations.smtp")).toBeUndefined()
  })

  it("editor cannot write (403)", async () => {
    expect(
      (await put(editor, "integrations.smtp", 0, smtpValues())).status
    ).toBe(403)
  })

  it("audits names of changed fields, never values", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    await put(
      owner,
      "integrations.smtp",
      1,
      smtpValues({ port: 2525, password: SMTP_PASSWORD })
    )
    const rows = await getDb()
      .select({ action: auditLog.action, diff: auditLog.diff })
      .from(auditLog)
      .where(eq(auditLog.entityId, "integrations.smtp"))
      .orderBy(auditLog.createdAt)
    expect(rows.map((r) => r.action)).toEqual([
      "integration.created",
      "integration.updated",
    ])
    expect(rows[1].diff).toEqual({ changed: ["port"] })
    expect(JSON.stringify(rows)).not.toContain(SMTP_PASSWORD)
  })

  it("an unreadable secret (e.g. after an app secret change) shows set without a hint", async () => {
    await put(owner, "integrations.r2", 0, {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "default",
      bucket: "sp-media",
      accessKeyId: "AKIDEXAMPLE1234",
      secretAccessKey: R2_SECRET,
    })
    await put(owner, "integrations.smtp", 0, smtpValues())
    const smtpStored = (await rawDraft("integrations.smtp")).draft as Record<
      string,
      string
    >
    const r2Stored = (await rawDraft("integrations.r2")).draft as Record<
      string,
      string
    >
    // Ciphertext moved to another field: the AAD no longer matches.
    await getDb()
      .update(settings)
      .set({ draft: { ...r2Stored, secretAccessKey: smtpStored.password } })
      .where(eq(settings.key, "integrations.r2"))
    const res = await adminRequest("/integrations/integrations.r2", {
      cookie: owner,
    })
    expect(((await res.json()) as IntegrationDto).secrets).toEqual({
      accessKeyId: { set: true, hint: "••••1234" },
      secretAccessKey: { set: true, hint: null },
    })
    await expect(readIntegrationConfig("integrations.r2")).rejects.toThrow(
      /cannot be decrypted/
    )
    // "Test connection" refuses until the secret is entered again.
    const tested = await adminRequest("/integrations/integrations.r2/test", {
      cookie: owner,
      method: "POST",
    })
    expect(tested.status).toBe(422)
    expect(
      ((await tested.json()) as { error: { fieldErrors: object } }).error
        .fieldErrors
    ).toEqual({ secretAccessKey: ["Enter this again and save"] })
  })

  it("an unreadable secret dropped on save is listed in the audit diff", async () => {
    await put(owner, "integrations.turnstile", 0, {
      enabled: true,
      siteKey: "0x4AAAAAAA",
      secretKey: "0x4AAAAAAA-secret",
    })
    const stored = (await rawDraft("integrations.turnstile")).draft as Record<
      string,
      string
    >
    await getDb()
      .update(settings)
      .set({ draft: { ...stored, secretKey: encryptSecret("x", "other.aad") } })
      .where(eq(settings.key, "integrations.turnstile"))
    const res = await put(owner, "integrations.turnstile", 1, {
      enabled: false,
      secretKey: "",
    })
    expect(res.status).toBe(200)
    expect(dto(res.text).secrets.secretKey).toEqual({ set: false, hint: null })
    const [last] = await getDb()
      .select({ diff: auditLog.diff })
      .from(auditLog)
      .where(eq(auditLog.action, "integration.updated"))
    expect(last.diff).toEqual({ changed: ["enabled", "secretKey"] })
  })
})

describe("PUT clearSecrets on other integrations (MK C7 Remove key)", () => {
  const clear = (
    cookie: string,
    version: number,
    values: Record<string, unknown>,
    fields: string[]
  ) =>
    adminRequest("/integrations/integrations.smtp", {
      cookie,
      method: "PUT",
      json: { version, values, clearSecrets: fields },
    })

  it("SMTP with a sign-in user cannot lose its password; without one it can", async () => {
    expect(
      (await put(owner, "integrations.smtp", 0, smtpValues())).status
    ).toBe(200)
    const refused = await clear(admin, 1, {}, ["password"])
    expect(refused.status).toBe(422)
    expect(
      (
        (await refused.json()) as {
          error: { fieldErrors: Record<string, string[]> }
        }
      ).error.fieldErrors
    ).toHaveProperty("password")
    expect((await rawDraft("integrations.smtp"))!.version).toBe(1)

    expect((await clear(editor, 1, {}, ["password"])).status).toBe(403)
    // A name of another integration's secret is not a secret here.
    expect((await clear(owner, 1, {}, ["apiKey"])).status).toBe(422)

    const cleared = await clear(owner, 1, { user: "" }, ["password"])
    expect(cleared.status).toBe(200)
    expect(dto(await cleared.text()).secrets.password).toEqual({
      set: false,
      hint: null,
    })
  })
})

describe("DELETE /api/v1/admin/integrations/:key (Disconnect)", () => {
  it("removes the row with the current version; stale → 409", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    expect(
      (
        await adminRequest("/integrations/integrations.smtp?version=7", {
          cookie: owner,
          method: "DELETE",
        })
      ).status
    ).toBe(409)
    const res = await adminRequest(
      "/integrations/integrations.smtp?version=1",
      {
        cookie: owner,
        method: "DELETE",
      }
    )
    expect(res.status).toBe(200)
    expect(await rawDraft("integrations.smtp")).toBeUndefined()
    expect(await readIntegrationConfig("integrations.smtp")).toBeNull()
  })

  it("keeps R2 while files are stored there", async () => {
    await put(owner, "integrations.r2", 0, {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "default",
      bucket: "sp-media",
      accessKeyId: "AKID1234",
      secretAccessKey: R2_SECRET,
    })
    await getDb().insert(media).values({
      key: "2026/10/0190a6e0-0000-7000-8000-000000000001.png",
      driver: "r2",
      mime: "image/png",
      size: 10,
    })
    const res = await adminRequest("/integrations/integrations.r2?version=1", {
      cookie: owner,
      method: "DELETE",
    })
    expect(res.status).toBe(409)
  })
})

describe("PUT integrations.r2 while files are stored there (final review I2)", () => {
  const r2Values = {
    accountId: "0123456789abcdef0123456789abcdef",
    jurisdiction: "default",
    bucket: "sp-media",
    accessKeyId: "AKID1234",
    secretAccessKey: R2_SECRET,
  }
  const storeOneFile = () =>
    getDb().insert(media).values({
      key: "2026/10/0190a6e0-0000-7000-8000-000000000002.png",
      driver: "r2",
      mime: "image/png",
      size: 10,
    })

  it.each([
    ["bucket", { bucket: "sp-media-2" }],
    ["account", { accountId: "fedcba9876543210fedcba9876543210" }],
    ["jurisdiction", { jurisdiction: "eu" }],
  ])(
    "a new %s → 409 naming the stored files; the row is unchanged",
    async (_name, change) => {
      await put(owner, "integrations.r2", 0, r2Values)
      await storeOneFile()
      const before = await rawDraft("integrations.r2")
      const res = await put(owner, "integrations.r2", 1, {
        ...r2Values,
        ...change,
        accessKeyId: "AKIDNEW5678",
        secretAccessKey: "r2-secret-access-key-2222",
      })
      expect(res.status).toBe(409)
      expect(
        (JSON.parse(res.text) as { error: { message: string } }).error.message
      ).toMatch(/1 uploaded file is stored in the current R2 bucket/)
      expect(await rawDraft("integrations.r2")).toEqual(before)
    }
  )

  it("rotating the keys of the same bucket still saves", async () => {
    await put(owner, "integrations.r2", 0, r2Values)
    await storeOneFile()
    const res = await put(owner, "integrations.r2", 1, {
      accessKeyId: "AKIDNEW5678",
      secretAccessKey: "r2-secret-access-key-2222",
    })
    expect(res.status).toBe(200)
  })

  it("without stored files the bucket may change (keys entered again)", async () => {
    await put(owner, "integrations.r2", 0, r2Values)
    const res = await put(owner, "integrations.r2", 1, {
      ...r2Values,
      bucket: "sp-media-2",
    })
    expect(res.status).toBe(200)
  })
})

describe("POST /api/v1/admin/integrations/:key/test", () => {
  const test = (cookie: string, key: string) =>
    adminRequest(`/integrations/${key}/test`, { cookie, method: "POST" })

  it("422 before anything is saved; editor 403", async () => {
    expect((await test(owner, "integrations.smtp")).status).toBe(422)
    expect((await test(editor, "integrations.smtp")).status).toBe(403)
  })

  it("SMTP: transporter.verify() against the dev Mailpit (pnpm db:up)", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const res = await test(admin, "integrations.smtp")
    expect(res.status).toBe(200)
    const body = (await res.json()) as IntegrationTestResult
    expect(body.ok).toBe(true)
    expect(body.message).toBe(
      "Connected to 127.0.0.1:1025 and signed in as mailer@example.test."
    )
  })

  it("SMTP: a failure is a 200 result without the password", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues({ port: 1 }))
    const res = await test(owner, "integrations.smtp")
    const text = await res.text()
    expect(res.status).toBe(200)
    expect((JSON.parse(text) as IntegrationTestResult).ok).toBe(false)
    expect(text).not.toContain(SMTP_PASSWORD)
  })

  it("R2: HeadBucket with the decrypted keys", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never)
    await put(owner, "integrations.r2", 0, {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "eu",
      bucket: "sp-media",
      accessKeyId: "AKID1234",
      secretAccessKey: R2_SECRET,
    })
    const body = (await (
      await test(owner, "integrations.r2")
    ).json()) as IntegrationTestResult
    expect(body.ok).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("Turnstile and AI call the provider (fetch stubbed)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("turnstile")
        ? Response.json({
            success: false,
            "error-codes": ["invalid-input-response"],
          })
        : Response.json({ id: "claude-sonnet-4-5" })
    )
    vi.stubGlobal("fetch", fetchMock)
    await put(owner, "integrations.turnstile", 0, {
      enabled: true,
      siteKey: "0x4AAAAAAA",
      secretKey: "0x4AAAAAAA-secret",
    })
    await put(owner, "integrations.ai", 0, {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKey: "sk-ant-secret-key",
      allowedRoles: ["owner", "admin", "editor"],
    })
    expect(
      (
        (await (
          await test(owner, "integrations.turnstile")
        ).json()) as IntegrationTestResult
      ).ok
    ).toBe(true)
    expect(
      (
        (await (
          await test(owner, "integrations.ai")
        ).json()) as IntegrationTestResult
      ).ok
    ).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("viewer cannot read integration secrets via revisions or audit (controller ruling)", () => {
  it("no revision rows; settings history is limited to editable content keys; audit is closed to viewers", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    expect(
      await getDb()
        .select()
        .from(revisions)
        .where(eq(revisions.entityId, "integrations.smtp"))
    ).toEqual([])
    // Even a planted snapshot (e.g. a future bug) is not served.
    const [planted] = await getDb()
      .insert(revisions)
      .values({
        entityType: "settings",
        entityId: "integrations.smtp",
        version: 1,
        data: smtpValues(),
      })
      .returning({ id: revisions.id })
    for (const cookie of [viewer, editor, owner]) {
      const list = await adminRequest("/revisions/settings/integrations.smtp", {
        cookie,
      })
      expect(list.status).toBe(404)
      const one = await adminRequest(
        `/revisions/settings/integrations.smtp/${planted.id}`,
        { cookie }
      )
      expect(one.status).toBe(404)
      expect(await one.text()).not.toContain(SMTP_PASSWORD)
    }
    // Content settings history still works for readers.
    expect(
      (await adminRequest("/revisions/settings/site", { cookie: viewer }))
        .status
    ).toBe(200)
    // Audit log: viewers have no audit:read; for the owner it holds field names only.
    expect((await adminRequest("/audit", { cookie: viewer })).status).toBe(403)
    const audit = await adminRequest("/audit?entityType=integration", {
      cookie: owner,
    })
    expect(audit.status).toBe(200)
    expect(await audit.text()).not.toContain(SMTP_PASSWORD)
  })
})

describe("secrets never reach the logs", () => {
  it("save, read and test log nothing containing a secret", async () => {
    const calls: unknown[][] = []
    for (const method of ["log", "info", "warn", "error", "debug"] as const)
      vi.spyOn(console, method).mockImplementation((...args) => {
        calls.push(args)
      })
    await put(owner, "integrations.smtp", 0, smtpValues({ port: 1 }))
    await adminRequest("/integrations", { cookie: owner })
    await adminRequest("/integrations/integrations.smtp/test", {
      cookie: owner,
      method: "POST",
    })
    expect(JSON.stringify(calls)).not.toContain(SMTP_PASSWORD)
  })
})
