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
    expect(m.tracking).toMatchObject({
      gtmEnabled: false,
      ga4Enabled: false,
      metaEnabled: false,
    })
    expect(m.consent?.manageLabel).toBe("Cookie settings")
    expect(m.customCode).toEqual({
      disabled: false,
      allowedHosts: [],
      snippets: [],
    })
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
      .set({
        draft: {
          disabled: false,
          allowedHosts: [],
          snippets: [
            {
              id: "6f1c7a52-3b0e-4d6a-9f3e-2a1b4c5d6e7f",
              name: "Draft only",
              placement: "head",
              src: "",
              html: "<script>1</script>",
              category: "necessary",
              routes: [],
              enabled: true,
            },
          ],
        },
      })
      .where(eq(settings.key, "customCode"))
    let m = await loadPublicMarketing()
    expect(m.tracking.enabled).toBe(false)
    expect(m.customCode.snippets).toEqual([])

    await getDb()
      .update(settings)
      .set({ published: { enabled: true, gtmId: "nope" } })
      .where(eq(settings.key, "tracking"))
    m = await loadPublicMarketing()
    expect(m.tracking).toEqual({
      enabled: false,
      gtmEnabled: false,
      gtmId: null,
      ga4Enabled: false,
      ga4Id: null,
      metaEnabled: false,
      metaPixelId: null,
    })
    expect(m.ids).toEqual({ gtmId: null, ga4Id: null, metaPixelId: null })
  })

  it("ids: only channels switched on in the published value", async () => {
    await getDb()
      .update(settings)
      .set({
        published: {
          enabled: true,
          gtmEnabled: false,
          gtmId: "GTM-X1",
          ga4Enabled: true,
          ga4Id: "G-X1",
          metaEnabled: true,
          metaPixelId: "123",
        },
      })
      .where(eq(settings.key, "tracking"))
    const m = await loadPublicMarketing()
    expect(m.ids).toEqual({ gtmId: null, ga4Id: "G-X1", metaPixelId: "123" })

    // Values saved before the switches existed parse with every channel off.
    await getDb()
      .update(settings)
      .set({
        published: {
          enabled: true,
          gtmId: "GTM-X1",
          ga4Id: null,
          metaPixelId: null,
        },
      })
      .where(eq(settings.key, "tracking"))
    expect((await loadPublicMarketing()).ids).toEqual({
      gtmId: null,
      ga4Id: null,
      metaPixelId: null,
    })
  })
})
