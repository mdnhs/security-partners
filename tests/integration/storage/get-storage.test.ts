import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import type { Actor } from "@/server/lib/actor"
import { encryptSecret } from "@/server/lib/crypto"
import { resetR2Client } from "@/server/lib/r2-client"
import { getStorage, storageFor } from "@/server/lib/storage"
import {
  deleteIntegration,
  saveIntegration,
} from "@/server/modules/integrations/service"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

let actor: Actor

const R2_VALUES = {
  accountId: "0123456789abcdef0123456789abcdef",
  jurisdiction: "default",
  bucket: "sp-media",
  accessKeyId: "AKID",
  secretAccessKey: "SECRET",
}

beforeEach(async () => {
  await resetDb()
  const owner = await createUser({ roles: ["owner"] })
  actor = {
    userId: owner.id,
    roles: ["owner"],
    ip: null,
    userAgent: null,
    impersonatorId: null,
  }
})
afterEach(() => {
  resetR2Client()
  vi.restoreAllMocks()
})

const saveR2 = (values: Record<string, string> = R2_VALUES, version = 0) =>
  saveIntegration(actor, "integrations.r2", { version, values })

describe("getStorage (Review Focus 3)", () => {
  it("is the disk driver while integrations.r2 is unset", async () => {
    expect((await getStorage()).name).toBe("disk")
    expect(await storageFor("static")).toBeNull()
    expect(await storageFor("r2")).toBeNull()
  })

  it("is R2 once integrations.r2 is saved", async () => {
    await saveR2()
    expect((await getStorage()).name).toBe("r2")
    expect((await storageFor("disk"))?.name).toBe("disk")
    expect((await storageFor("r2"))?.name).toBe("r2")
  })

  it("talks to the saved bucket through one shared client", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never)
    await saveR2({ ...R2_VALUES, bucket: "sp-saved-bucket" })
    await (await getStorage()).test()
    await (await storageFor("r2"))!.test()
    expect(send).toHaveBeenCalledTimes(2)
    const [first, second] = send.mock.calls.map(
      ([command]) => command as HeadBucketCommand
    )
    expect(first).toBeInstanceOf(HeadBucketCommand)
    expect(first.input).toEqual({ Bucket: "sp-saved-bucket" })
    expect(second.input).toEqual({ Bucket: "sp-saved-bucket" })
    expect(send.mock.contexts[0]).toBe(send.mock.contexts[1])
  })

  it("disconnecting R2 destroys the shared client", async () => {
    const destroy = vi.spyOn(S3Client.prototype, "destroy")
    const saved = await saveR2()
    await getStorage()
    await deleteIntegration(actor, "integrations.r2", saved.version)
    expect(destroy).toHaveBeenCalledOnce()
    expect((await getStorage()).name).toBe("disk")
  })

  it("throws (no silent fallback to disk) when R2 secrets cannot be decrypted", async () => {
    await saveR2()
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "integrations.r2"))
    await getDb()
      .update(settings)
      .set({
        draft: {
          ...(row.draft as Record<string, unknown>),
          secretAccessKey: encryptSecret("SECRET", "other.aad"),
        },
      })
      .where(eq(settings.key, "integrations.r2"))
    await expect(getStorage()).rejects.toThrow(/cannot be decrypted/)
    await expect(storageFor("r2")).rejects.toThrow(/cannot be decrypted/)
  })
})
