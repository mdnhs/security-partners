import { beforeEach, describe, expect, it } from "vitest"

import { getStorage, storageFor } from "@/server/lib/storage"
import type { Actor } from "@/server/lib/actor"
import { saveIntegration } from "@/server/modules/integrations/service"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

let actor: Actor

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

describe("getStorage (Review Focus 3)", () => {
  it("is the disk driver while integrations.r2 is unset", async () => {
    expect((await getStorage()).name).toBe("disk")
    expect(await storageFor("static")).toBeNull()
    expect(await storageFor("r2")).toBeNull()
  })

  it("is R2 once integrations.r2 is saved", async () => {
    await saveIntegration(actor, "integrations.r2", {
      version: 0,
      values: {
        accountId: "0123456789abcdef0123456789abcdef",
        jurisdiction: "default",
        bucket: "sp-media",
        accessKeyId: "AKID",
        secretAccessKey: "SECRET",
      },
    })
    expect((await getStorage()).name).toBe("r2")
    expect((await storageFor("disk"))?.name).toBe("disk")
    expect((await storageFor("r2"))?.name).toBe("r2")
  })
})
