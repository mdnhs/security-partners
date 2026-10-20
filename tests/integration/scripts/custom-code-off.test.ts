import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { customCodeOff } from "@/scripts/custom-code-off"
import { getDb } from "@/server/db/client"
import { auditLog, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { loadPublicMarketing } from "@/server/modules/marketing/public"

import { resetDb } from "../db"

const SNIPPET = {
  id: "6f1c7a52-3b0e-4d6a-9f3e-2a1b4c5d6e7f",
  name: "Chat widget",
  placement: "body",
  src: "",
  html: "<script>window.__x=1</script>",
  category: "necessary",
  routes: [],
  enabled: true,
}
const LIVE = { disabled: false, allowedHosts: [], snippets: [SNIPPET] }

const row = async () =>
  (
    await getDb().select().from(settings).where(eq(settings.key, "customCode"))
  )[0]!

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("pnpm custom-code:off (customCodeOff)", () => {
  it("switches draft and published off, bumps the version, audits with no actor and expires the cache", async () => {
    await getDb()
      .update(settings)
      .set({ draft: LIVE, published: LIVE })
      .where(eq(settings.key, "customCode"))
    expect((await loadPublicMarketing()).customCode.snippets).toHaveLength(1)
    const before = await row()
    const revalidate = vi.fn(async () => undefined)
    const now = new Date("2026-10-19T12:00:00.000Z")

    await customCodeOff(getDb(), now, revalidate)

    const after = await row()
    expect(after.draft).toEqual({ ...LIVE, disabled: true })
    expect(after.published).toEqual({ ...LIVE, disabled: true })
    expect(after.version).toBe(before.version + 1)
    expect(after.updatedBy).toBeNull()
    const audits = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "customCode.killSwitch"))
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      actorId: null,
      impersonatorId: null,
      entityType: "settings",
      entityId: "customCode",
      diff: { disabled: true, at: now.toISOString() },
    })
    expect(revalidate).toHaveBeenCalledWith(["settings:customCode"])
    // The public reader now runs nothing.
    expect((await loadPublicMarketing()).customCode.disabled).toBe(true)
  })

  it("an unpublished value stays unpublished; re-running is harmless", async () => {
    await getDb()
      .update(settings)
      .set({ draft: LIVE, published: null })
      .where(eq(settings.key, "customCode"))
    const revalidate = vi.fn(async () => undefined)
    await customCodeOff(getDb(), new Date(), revalidate)
    await customCodeOff(getDb(), new Date(), revalidate)
    const after = await row()
    expect(after.published).toBeNull()
    expect(after.draft).toEqual({ ...LIVE, disabled: true })
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "customCode.killSwitch"))
    ).toHaveLength(2)
  })

  it("a failed cache refresh still leaves the switch off and audited, then reports it", async () => {
    await getDb()
      .update(settings)
      .set({ draft: LIVE, published: LIVE })
      .where(eq(settings.key, "customCode"))
    const revalidate = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED")
    })
    await expect(
      customCodeOff(getDb(), new Date(), revalidate)
    ).rejects.toThrow(/switched off.*restart/i)
    expect(((await row()).published as typeof LIVE).disabled).toBe(true)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "customCode.killSwitch"))
    ).toHaveLength(1)
  })

  it("with no customCode row there is nothing to switch off (no audit)", async () => {
    await getDb().delete(settings).where(eq(settings.key, "customCode"))
    const revalidate = vi.fn(async () => undefined)
    await customCodeOff(getDb(), new Date(), revalidate)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "customCode.killSwitch"))
    ).toHaveLength(0)
    expect(revalidate).not.toHaveBeenCalled()
  })
})
