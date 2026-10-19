import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"
import { listOwnerContacts } from "@/server/modules/users/service"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

beforeEach(async () => {
  await resetDb()
})

describe("listOwnerContacts (Help page, MK B7)", () => {
  it("returns only active owners, by name", async () => {
    await createUser({
      roles: ["owner"],
      name: "Zoe Owner",
      email: "zoe@example.ie",
    })
    await createUser({
      roles: ["admin", "owner"],
      name: "Abe Owner",
      email: "abe@example.ie",
    })
    await createUser({ roles: ["admin"], name: "Ada Admin" })
    // Invited (no password yet) and banned owners are not contacts.
    await createUser({ roles: ["owner"], name: "Ivy Invited", password: null })
    const banned = await createUser({ roles: ["owner"], name: "Bo Banned" })
    await getDb()
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, banned.id))

    expect(await listOwnerContacts()).toEqual([
      { name: "Abe Owner", email: "abe@example.ie" },
      { name: "Zoe Owner", email: "zoe@example.ie" },
    ])
  })
})
