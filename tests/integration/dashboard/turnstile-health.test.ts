import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import type { Actor } from "@/server/lib/actor"
import { encryptSecret } from "@/server/lib/crypto"
import { getDashboard } from "@/server/modules/dashboard/service"
import { integrationReadState } from "@/server/modules/integrations/service"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

const actorOf = (userId: string, roles: Actor["roles"]): Actor => ({
  userId,
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})

const KEY = "integrations.turnstile"

async function saveTurnstile(secretKey: string) {
  await getDb()
    .insert(settings)
    .values({
      key: KEY,
      draft: { enabled: true, siteKey: "0x4AAAAAAAtestsitekey", secretKey },
      published: null,
      version: 1,
    })
}
const readable = () =>
  saveTurnstile(encryptSecret("turnstile-secret-value", `${KEY}.secretKey`))
// What a changed BETTER_AUTH_SECRET leaves behind: a secret that no longer opens.
const unreadable = () => saveTurnstile("v1:not:a:secret")

const turnstileItem = async (actor: Actor) =>
  (await getDashboard(actor)).nextUp.find(
    (item) => item.id === "turnstile-unreadable"
  )

beforeEach(resetDb)

describe("integrationReadState", () => {
  it("missing, ok or unreadable, exactly as the leads route sees it", async () => {
    expect(await integrationReadState(KEY)).toBe("missing")
    await readable()
    expect(await integrationReadState(KEY)).toBe("ok")
    await getDb().delete(settings).where(eq(settings.key, KEY))
    await unreadable()
    expect(await integrationReadState(KEY)).toBe("unreadable")
  })

  it("a transient database error is rethrown, never read as 'unreadable' (no false 'Spam protection is off')", async () => {
    await readable()
    const dbDown = Object.assign(new Error("Connection terminated"), {
      code: "57P01",
    })
    const db = {
      select: () => {
        throw dbDown
      },
    } as unknown as Parameters<typeof integrationReadState>[1]
    await expect(integrationReadState(KEY, db)).rejects.toBe(dbDown)
    // The real database still reads the settings fine.
    expect(await integrationReadState(KEY)).toBe("ok")
  })
})

describe("dashboard Next up: Turnstile settings unreadable (fail-open made visible)", () => {
  it("warns integration readers first, with the fix, while the leads route fails open", async () => {
    const owner = await createUser({ roles: ["owner"] })
    await unreadable()
    const { nextUp } = await getDashboard(actorOf(owner.id, ["owner"]))
    expect(nextUp[0]).toEqual({
      id: "turnstile-unreadable",
      title: "Spam protection is off",
      description:
        "Turnstile settings can't be read — re-enter the keys in Integrations.",
      href: "/admin/settings/integrations/turnstile",
      done: false,
    })
  })

  it("is hidden from roles without integration:read", async () => {
    const editor = await createUser({ roles: ["editor"] })
    await unreadable()
    expect(await turnstileItem(actorOf(editor.id, ["editor"]))).toBeUndefined()
  })

  it("never shows when Turnstile is not configured (the seeded state) or reads fine", async () => {
    await seedContent(getDb())
    const owner = await createUser({ roles: ["owner"] })
    const actor = actorOf(owner.id, ["owner"])
    expect(await turnstileItem(actor)).toBeUndefined()
    await readable()
    expect(await turnstileItem(actor)).toBeUndefined()
  })
})
