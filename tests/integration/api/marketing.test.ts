import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { GrowthSettingsDto } from "@/lib/schemas/api/marketing"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let owner: string
let admin: string
let editor: string
let marketer: string
let viewer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  owner = (await signedInUser(["owner"])).cookie
  admin = (await signedInUser(["admin"])).cookie
  editor = (await signedInUser(["editor"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  revalidateTag.mockClear()
})

const get = (cookie: string, key: string) =>
  adminRequest(`/marketing/${key}`, { cookie })

async function saveAndPublish(
  cookie: string,
  key: string,
  change: (draft: Record<string, unknown>) => unknown
) {
  const dto = (await (await get(cookie, key)).json()) as GrowthSettingsDto
  const saved = await adminRequest(`/marketing/${key}/draft`, {
    cookie,
    method: "PUT",
    json: {
      draft: change(dto.draft as Record<string, unknown>),
      version: dto.version,
    },
  })
  expect(saved.status).toBe(200)
  const { version } = (await saved.json()) as GrowthSettingsDto
  return adminRequest(`/marketing/${key}/publish`, {
    cookie,
    method: "POST",
    json: { version },
  })
}

describe("SEO/marketing settings API (master 8.1, 8.3)", () => {
  it("marketer edits tracking with draft → publish; settings:tracking expires", async () => {
    const res = await saveAndPublish(marketer, "tracking", (d) => ({
      ...d,
      enabled: true,
      gtmId: "GTM-ABC123",
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      key: "tracking",
      label: "Tracking",
      dirty: false,
      canEdit: true,
      published: { enabled: true, gtmId: "GTM-ABC123" },
    })
    expect(revalidateTag).toHaveBeenCalledWith("settings:tracking", {
      expire: 0,
    })
  })

  it("permissions per key; custom code is owner-only", async () => {
    expect((await get(editor, "tracking")).status).toBe(403)
    expect((await get(editor, "seo.defaults")).status).toBe(200)
    expect((await get(viewer, "consent")).status).toBe(200)
    expect(
      (
        await adminRequest("/marketing/consent/draft", {
          cookie: viewer,
          method: "PUT",
          json: { draft: {}, version: 1 },
        })
      ).status
    ).toBe(403)
    expect((await get(admin, "customCode")).status).toBe(403)
    expect(
      (
        await adminRequest("/marketing/customCode/draft", {
          cookie: admin,
          method: "PUT",
          json: { draft: { headHtml: "", bodyEndHtml: "" }, version: 1 },
        })
      ).status
    ).toBe(403)
    const published = await saveAndPublish(owner, "customCode", (d) => ({
      ...d,
      headHtml: '<meta name="x" content="y">',
    }))
    expect(published.status).toBe(200)
  })

  it("keys edited elsewhere are 404 here; these keys stay 404 under /settings", async () => {
    for (const key of ["site", "leads", "integrations.smtp", "nope"])
      expect((await get(owner, key)).status, key).toBe(404)
    expect(
      (await adminRequest("/settings/consent", { cookie: owner })).status
    ).toBe(404)
  })

  it("invalid values → 422 with field paths", async () => {
    const dto = (await (
      await get(marketer, "tracking")
    ).json()) as GrowthSettingsDto
    const res = await adminRequest("/marketing/tracking/draft", {
      cookie: marketer,
      method: "PUT",
      json: {
        draft: { ...(dto.draft as object), gtmId: "ABC" },
        version: dto.version,
      },
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toEqual(["gtmId"])
  })

  it("history follows each key's read permission; integrations never", async () => {
    await saveAndPublish(owner, "customCode", (d) => ({
      ...d,
      bodyEndHtml: "<script>window.x=1</script>",
    }))
    await saveAndPublish(marketer, "consent", (d) => ({
      ...d,
      title: "Cookies?",
    }))
    const history = (cookie: string, key: string) =>
      adminRequest(`/revisions/settings/${key}`, { cookie })
    expect((await history(owner, "customCode")).status).toBe(200)
    expect((await history(admin, "customCode")).status).toBe(403)
    expect((await history(viewer, "customCode")).status).toBe(403)
    expect((await history(marketer, "consent")).status).toBe(200)
    expect((await history(editor, "consent")).status).toBe(403)
    expect((await history(editor, "seo.defaults")).status).toBe(200)
    expect((await history(viewer, "contact")).status).toBe(200)
    expect((await history(owner, "integrations.smtp")).status).toBe(404)
  })
})
