import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { cacheTag, preview } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  preview: { on: false },
}))
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag }))
vi.mock("@/server/modules/preview/guard", () => ({
  isPreviewing: async () => preview.on,
}))

import { DEFAULT_THEME, ThemeConfig } from "@/lib/theme/schema"
import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import {
  getPreviewableSiteTheme,
  getPublishedTheme,
} from "@/server/modules/theme/queries"

import { resetDb } from "../db"

const draft = ThemeConfig.parse({ site: { brand: "#1d4ed8" } })
const published = ThemeConfig.parse({ admin: { radius: 1 } })

beforeEach(async () => {
  await resetDb()
  preview.on = false
  cacheTag.mockClear()
})

const insertTheme = (values: { draft: unknown; published: unknown }) =>
  getDb()
    .insert(settings)
    .values({ key: "theme", ...values })

describe("theme queries", () => {
  it("getPublishedTheme: the published value, tagged settings:theme", async () => {
    await insertTheme({ draft, published })
    expect(await getPublishedTheme()).toEqual(published)
    expect(cacheTag).toHaveBeenCalledWith("settings:theme")
  })

  it("getPublishedTheme: DEFAULT_THEME when the row is missing or invalid", async () => {
    expect(await getPublishedTheme()).toEqual(DEFAULT_THEME)
    await insertTheme({
      draft,
      published: { admin: { primary: "red;}body{" } },
    })
    expect(await getPublishedTheme()).toEqual(DEFAULT_THEME)
    await getDb()
      .update(settings)
      .set({ published: null })
      .where(eq(settings.key, "theme"))
    expect(await getPublishedTheme()).toEqual(DEFAULT_THEME)
  })

  it("getPreviewableSiteTheme: draft site only for a verified previewer", async () => {
    await insertTheme({ draft, published })
    expect(await getPreviewableSiteTheme()).toEqual(published.site)
    preview.on = true
    expect(await getPreviewableSiteTheme()).toEqual(draft.site)
  })
})
