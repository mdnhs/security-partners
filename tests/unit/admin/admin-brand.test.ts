import { beforeEach, describe, expect, it, vi } from "vitest"

const getPublishedSettings = vi.fn()
const getMedia = vi.fn()
vi.mock("@/server/modules/settings/queries", () => ({
  getPublishedSettings: (key: string) => getPublishedSettings(key),
}))
vi.mock("@/server/modules/media/queries", () => ({
  getMedia: (id: string) => getMedia(id),
}))

import { loadAdminBrand } from "@/server/lib/admin-brand"

const LOGO_ID = "00000000-0000-4000-8000-000000000001"
const DARK_ID = "00000000-0000-4000-8000-000000000002"
const ANIM_ID = "00000000-0000-4000-8000-000000000003"

const media = (id: string, url: string) => ({
  id,
  url,
  alt: "",
  width: 224,
  height: 136,
  blurDataUrl: null,
})

const site = (over: Record<string, unknown> = {}) => ({
  name: "Security Partners",
  logo: { mediaId: LOGO_ID },
  logoAlt: "Security Partners Ltd.",
  logoOnDark: null,
  logoAnimation: null,
  ...over,
})

beforeEach(() => {
  getPublishedSettings.mockReset()
  getMedia.mockReset()
  getMedia.mockImplementation(async (id: string) =>
    id === LOGO_ID
      ? media(id, "/images/logo.png")
      : id === DARK_ID
        ? media(id, "/api/v1/media/file/dark.png")
        : id === ANIM_ID
          ? media(id, "/api/v1/media/file/a.json")
          : null
  )
})

describe("loadAdminBrand (sidebar logo)", () => {
  it("reads the published site settings and resolves the logo", async () => {
    getPublishedSettings.mockResolvedValue(site())
    await expect(loadAdminBrand()).resolves.toEqual({
      name: "Security Partners",
      logo: {
        src: "/images/logo.png",
        alt: "Security Partners Ltd.",
        width: 224,
        height: 136,
      },
      logoOnDark: null,
      animation: null,
    })
    expect(getPublishedSettings).toHaveBeenCalledWith("site")
  })

  it("carries the dark logo and the Lottie URL when set", async () => {
    getPublishedSettings.mockResolvedValue(
      site({
        logoOnDark: { mediaId: DARK_ID },
        logoAnimation: { mediaId: ANIM_ID },
      })
    )
    await expect(loadAdminBrand()).resolves.toMatchObject({
      logoOnDark: "/api/v1/media/file/dark.png",
      animation: "/api/v1/media/file/a.json",
    })
  })

  it("is null (the SP chip) without published settings or logo row", async () => {
    getPublishedSettings.mockResolvedValue(null)
    await expect(loadAdminBrand()).resolves.toBeNull()
    getPublishedSettings.mockResolvedValue(
      site({ logo: { mediaId: "00000000-0000-4000-8000-00000000000f" } })
    )
    await expect(loadAdminBrand()).resolves.toBeNull()
  })

  it("degrades to null when a query fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    getPublishedSettings.mockRejectedValue(new Error("db down"))
    await expect(loadAdminBrand()).resolves.toBeNull()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
