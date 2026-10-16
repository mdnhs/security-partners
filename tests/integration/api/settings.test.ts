import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { SettingsDto, SettingsListItem } from "@/lib/schemas/api/settings"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let admin: string
let owner: string
let viewer: string
let marketer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  admin = (await signedInUser(["admin"])).cookie
  owner = (await signedInUser(["owner"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  revalidateTag.mockClear()
})

const get = async (cookie: string, key: string) => {
  const res = await adminRequest(`/settings/${key}`, { cookie })
  return {
    status: res.status,
    body: res.ok ? ((await res.json()) as SettingsDto) : null,
  }
}

describe("settings API (master 4.5)", () => {
  it("lists every content key with its group; editors cannot edit leads", async () => {
    const res = await adminRequest("/settings", { cookie: editor })
    const { items } = (await res.json()) as { items: SettingsListItem[] }
    expect(items.map((i) => i.key)).toEqual([
      "site",
      "contact",
      "navigation",
      "footer",
      "microcopy",
      "sections.about",
      "sections.contact",
      "sections.enquireBanner",
      "sections.clients",
      "sections.whyChooseUs",
      "leads",
    ])
    expect(items.find((i) => i.key === "contact")).toMatchObject({
      group: "General",
      canEdit: true,
      version: 1,
      dirty: false,
    })
    expect(items.find((i) => i.key === "leads")?.canEdit).toBe(false)
    expect(items[0]).not.toHaveProperty("draft")
  })

  it("edits a content key with draft → publish and invalidates settings:<key>", async () => {
    const { body } = await get(editor, "contact")
    const draft = {
      ...(body!.draft as Record<string, string>),
      hours: "Monday–Saturday, 8am to 8pm",
    }
    const saved = await adminRequest("/settings/contact/draft", {
      cookie: editor,
      method: "PUT",
      json: { draft, version: 1 },
    })
    expect(saved.status).toBe(200)
    expect((await saved.json()) as SettingsDto).toMatchObject({
      version: 2,
      dirty: true,
    })
    expect(revalidateTag).not.toHaveBeenCalled()

    const published = await adminRequest("/settings/contact/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    expect(published.status).toBe(200)
    const dto = (await published.json()) as SettingsDto
    expect(dto).toMatchObject({ version: 3, dirty: false, status: "published" })
    expect((dto.published as { hours: string }).hours).toBe(
      "Monday–Saturday, 8am to 8pm"
    )
    expect(revalidateTag).toHaveBeenCalledWith("settings:contact", {
      expire: 0,
    })

    const history = await adminRequest("/revisions/settings/contact", {
      cookie: viewer,
    })
    expect(
      ((await history.json()) as { items: { version: number }[] }).items.map(
        (r) => r.version
      )
    ).toEqual([3])
  })

  it("validates with the key's schema and rejects stale versions", async () => {
    const { body } = await get(editor, "contact")
    const bad = await adminRequest("/settings/contact/draft", {
      cookie: editor,
      method: "PUT",
      json: {
        draft: { ...(body!.draft as object), email: "not-an-email" },
        version: 1,
      },
    })
    expect(bad.status).toBe(422)
    expect(
      Object.keys(
        ((await bad.json()) as { error: { fieldErrors: object } }).error
          .fieldErrors
      )
    ).toEqual(["email"])

    await adminRequest("/settings/contact/draft", {
      cookie: editor,
      method: "PUT",
      json: { draft: body!.draft, version: 1 },
    })
    const stale = await adminRequest("/settings/contact/draft", {
      cookie: admin,
      method: "PUT",
      json: { draft: body!.draft, version: 1 },
    })
    expect(stale.status).toBe(409)
    expect(
      ((await stale.json()) as { error: { current: SettingsDto } }).error
        .current.version
    ).toBe(2)
  })

  it("enforces permissions per key group", async () => {
    const leads = await get(editor, "leads")
    expect(leads.status).toBe(200)
    const put = (cookie: string) =>
      adminRequest("/settings/leads/draft", {
        cookie,
        method: "PUT",
        json: { draft: leads.body!.draft, version: leads.body!.version },
      })
    expect((await put(editor)).status).toBe(403)
    expect((await put(admin)).status).toBe(200)
    expect(
      (
        await adminRequest("/settings/site/draft", {
          cookie: viewer,
          method: "PUT",
          json: { draft: {}, version: 1 },
        })
      ).status
    ).toBe(403)
    expect((await adminRequest("/settings", { cookie: marketer })).status).toBe(
      403
    )
  })

  it.each([
    "consent",
    "tracking",
    "customCode",
    "seo.defaults",
    "integrations.smtp",
    "nope",
  ])("rejects %s here (edited in another module)", async (key) => {
    expect((await get(owner, key)).status).toBe(404)
    const res = await adminRequest(`/settings/${key}/draft`, {
      cookie: owner,
      method: "PUT",
      json: { draft: {}, version: 1 },
    })
    expect(res.status).toBe(404)
  })
})
