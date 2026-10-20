import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { auditLog, settings } from "@/server/db/schema"
import { bootstrapR2, r2ConfigFromEnv } from "@/server/lib/r2-bootstrap"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { resetDb } from "../db"

const ENV = {
  SP_R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  SP_R2_ACCESS_KEY_ID: "bootstrap-access-key-id",
  SP_R2_SECRET_ACCESS_KEY: "bootstrap-secret-access-key",
  SP_R2_BUCKET: "shared-media",
}

const rawDraft = async () => {
  const [row] = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, "integrations.r2"))
  return row
}

beforeEach(() => resetDb())

describe("r2ConfigFromEnv", () => {
  it("nothing set (or only empty values, as compose passes ${X:-}) → null", () => {
    expect(r2ConfigFromEnv({})).toBeNull()
    expect(
      r2ConfigFromEnv({
        SP_R2_ACCOUNT_ID: "",
        SP_R2_ACCESS_KEY_ID: "",
        SP_R2_SECRET_ACCESS_KEY: "",
        SP_R2_BUCKET: "",
        SP_R2_PREFIX: "",
      })
    ).toBeNull()
  })

  it("defaults the folder to sp; SP_R2_PREFIX overrides it", () => {
    expect(r2ConfigFromEnv(ENV)).toEqual({
      accountId: ENV.SP_R2_ACCOUNT_ID,
      jurisdiction: "default",
      bucket: "shared-media",
      accessKeyId: ENV.SP_R2_ACCESS_KEY_ID,
      secretAccessKey: ENV.SP_R2_SECRET_ACCESS_KEY,
      keyPrefix: "sp",
    })
    expect(
      r2ConfigFromEnv({ ...ENV, SP_R2_PREFIX: "sp/media" })?.keyPrefix
    ).toBe("sp/media")
  })

  it("some set, some missing → error naming the missing variables only", () => {
    const run = () =>
      r2ConfigFromEnv({ ...ENV, SP_R2_BUCKET: "", SP_R2_ACCOUNT_ID: "" })
    expect(run).toThrow("SP_R2_ACCOUNT_ID, SP_R2_BUCKET")
    expect(run).not.toThrow(/bootstrap-secret/)
  })

  it("invalid values → error naming the variables, never their values", () => {
    let message = ""
    try {
      r2ConfigFromEnv({
        ...ENV,
        SP_R2_BUCKET: "Bad_Bucket",
        SP_R2_PREFIX: "/bad/",
      })
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toContain("SP_R2_BUCKET")
    expect(message).toContain("SP_R2_PREFIX")
    expect(message).not.toMatch(/Bad_Bucket|\/bad\/|bootstrap-/)
  })
})

describe("bootstrapR2 (container start)", () => {
  it("without the variables does nothing", async () => {
    expect(await bootstrapR2({})).toBe("not-set")
    expect(await rawDraft()).toBeUndefined()
  })

  it("saves integrations.r2 encrypted like the admin, audited as the system", async () => {
    expect(await bootstrapR2(ENV)).toBe("saved")
    expect(await readIntegrationConfig("integrations.r2")).toEqual({
      accountId: ENV.SP_R2_ACCOUNT_ID,
      jurisdiction: "default",
      bucket: "shared-media",
      accessKeyId: ENV.SP_R2_ACCESS_KEY_ID,
      secretAccessKey: ENV.SP_R2_SECRET_ACCESS_KEY,
      keyPrefix: "sp",
    })
    const row = await rawDraft()
    expect(row.updatedBy).toBeNull()
    expect(JSON.stringify(row.draft)).not.toContain("bootstrap-")
    const audits = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, "integrations.r2"))
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      actorId: null,
      action: "integration.created",
    })
    expect(audits[0].diff).toMatchObject({ via: "r2-bootstrap" })
    expect(JSON.stringify(audits[0].diff)).not.toContain("bootstrap-")
  })

  it("never overwrites saved settings (idempotent on every start)", async () => {
    expect(await bootstrapR2(ENV)).toBe("saved")
    const before = await rawDraft()
    expect(await bootstrapR2({ ...ENV, SP_R2_BUCKET: "another-bucket" })).toBe(
      "exists"
    )
    expect(await rawDraft()).toEqual(before)
  })
})
