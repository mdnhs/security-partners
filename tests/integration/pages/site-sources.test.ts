import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))

import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { loadSiteSources } from "@/server/modules/pages/sources"

import { resetDb } from "../db"

/** Ids differ between DB and fixtures; media compare by URL. */
function comparable(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (key === "id") return undefined
      if (v && typeof v === "object" && "url" in v && "blurDataUrl" in v)
        return v.url
      return v
    })
  )
}

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("loadSiteSources (DB) — Review Focus 1", () => {
  it("returns exactly what the static site rendered (the seed fixtures)", async () => {
    expect(comparable(await loadSiteSources())).toEqual(
      comparable(fixtureSiteSources())
    )
  })

  it("resolves seeded images to their public/ paths", async () => {
    const sources = await loadSiteSources()
    expect(sources.settings.site.logo).toMatchObject({
      url: "/images/logo.png",
      width: 140,
      height: 85,
    })
    expect(sources.clients[0].logo.url).toBe("/images/client-dinn-ri.png")
  })

  it("fails loudly (error page) when content is not seeded", async () => {
    await getDb().delete(settings).where(eq(settings.key, "footer"))
    await expect(loadSiteSources()).rejects.toThrow(
      "Missing published content: settings.footer. Run pnpm db:seed."
    )
  })
})
