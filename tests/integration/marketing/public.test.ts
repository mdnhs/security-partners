import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { loadPublicMarketing } from "@/server/modules/marketing/public"

import { resetDb } from "../db"

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("loadPublicMarketing (published values only)", () => {
  it("seeded: tracking off, consent copy, no custom code", async () => {
    const m = await loadPublicMarketing()
    expect(m.tracking.enabled).toBe(false)
    expect(m.consent?.manageLabel).toBe("Cookie settings")
    expect(m.customCode).toEqual({ headHtml: "", bodyEndHtml: "" })
  })

  it("never reads drafts; invalid published values switch tracking off", async () => {
    await getDb()
      .update(settings)
      .set({
        draft: {
          enabled: true,
          gtmId: "GTM-X1",
          ga4Id: null,
          metaPixelId: null,
        },
      })
      .where(eq(settings.key, "tracking"))
    await getDb()
      .update(settings)
      .set({ draft: { headHtml: "<script>1</script>", bodyEndHtml: "" } })
      .where(eq(settings.key, "customCode"))
    let m = await loadPublicMarketing()
    expect(m.tracking.enabled).toBe(false)
    expect(m.customCode.headHtml).toBe("")

    await getDb()
      .update(settings)
      .set({ published: { enabled: true, gtmId: "nope" } })
      .where(eq(settings.key, "tracking"))
    m = await loadPublicMarketing()
    expect(m.tracking).toEqual({
      enabled: false,
      gtmId: null,
      ga4Id: null,
      metaPixelId: null,
    })
  })
})
