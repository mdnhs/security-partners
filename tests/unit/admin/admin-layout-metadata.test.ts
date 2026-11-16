import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  site: null as unknown,
  fail: false,
}))

vi.mock("next/font/google", () => ({
  Geist_Mono: () => ({ variable: "" }),
  Plus_Jakarta_Sans: () => ({ variable: "" }),
}))
vi.mock("next/server", () => ({ connection: async () => {} }))
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }))
vi.mock("@/server/modules/settings/queries", () => ({
  getPublishedSettings: async () => {
    if (state.fail) throw new Error("database down")
    return state.site
  },
}))
vi.mock("@/server/modules/media/queries", () => ({
  resolveMedia: async (value: { favicon: { mediaId: string } | null }) => ({
    favicon: value.favicon
      ? { url: `/api/v1/media/file/${value.favicon.mediaId}.png` }
      : null,
  }),
}))
vi.mock("@/components/admin/theme-provider", () => ({
  AdminThemeProvider: () => null,
}))

import { generateMetadata } from "@/app/(admin)/admin/layout"

beforeEach(() => {
  state.site = null
  state.fail = false
})

describe("admin tab icon", () => {
  it("is the site's favicon from Settings, as on the public site", async () => {
    state.site = { favicon: { mediaId: "abc" } }
    const meta = await generateMetadata()
    expect(meta.icons).toEqual({ icon: "/api/v1/media/file/abc.png" })
  })

  it("is the bundled icon until a favicon is set", async () => {
    state.site = { favicon: null }
    expect((await generateMetadata()).icons).toEqual({ icon: "/favicon.ico" })
  })

  it("is the bundled icon, not an error, when settings cannot be read", async () => {
    state.fail = true
    const meta = await generateMetadata()
    expect(meta.icons).toEqual({ icon: "/favicon.ico" })
    expect(meta.robots).toEqual({ index: false, follow: false })
  })

  it("keeps the admin title template", async () => {
    expect((await generateMetadata()).title).toEqual({
      default: "Admin · Security Partners",
      template: "%s · Security Partners admin",
    })
  })
})
