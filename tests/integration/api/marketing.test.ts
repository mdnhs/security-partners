import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { GrowthSettingsDto } from "@/lib/schemas/api/marketing"
import { getDb } from "@/server/db/client"
import { auditLog, settings } from "@/server/db/schema"
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
  it("owner edits tracking with draft → publish; settings:tracking expires", async () => {
    const res = await saveAndPublish(owner, "tracking", (d) => ({
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

  it("publishing tracking and custom code is audited (settings.published)", async () => {
    expect(
      (
        await saveAndPublish(marketer, "tracking", (d) => ({
          ...d,
          enabled: true,
        }))
      ).status
    ).toBe(200)
    expect(
      (
        await saveAndPublish(owner, "customCode", () => ({
          headHtml: "<!-- x -->",
          bodyEndHtml: "",
        }))
      ).status
    ).toBe(200)
    const rows = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "settings.published"))
    expect(rows.map((r) => r.entityId).sort()).toEqual([
      "customCode",
      "tracking",
    ])
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

  it("seo.defaults: a title pattern without {title} → 422 on save and on publish", async () => {
    const dto = (await (
      await get(owner, "seo.defaults")
    ).json()) as GrowthSettingsDto
    const draft = {
      ...(dto.draft as Record<string, unknown>),
      titleTemplate: "Security Partners Ltd.",
    }
    const saved = await adminRequest("/marketing/seo.defaults/draft", {
      cookie: owner,
      method: "PUT",
      json: { draft, version: dto.version },
    })
    expect(saved.status).toBe(422)
    expect(
      (
        (await saved.json()) as {
          error: { fieldErrors: Record<string, string[]> }
        }
      ).error.fieldErrors
    ).toEqual({ titleTemplate: ["Include {title} where the page name goes"] })

    // A draft stored before the rule (or written around the API) cannot go live.
    await getDb()
      .update(settings)
      .set({ draft })
      .where(eq(settings.key, "seo.defaults"))
    const published = await adminRequest("/marketing/seo.defaults/publish", {
      cookie: owner,
      method: "POST",
      json: { version: dto.version },
    })
    expect(published.status).toBe(422)
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "seo.defaults"))
    expect(
      (row.published as { titleTemplate: string }).titleTemplate
    ).toContain("{title}")
  })

  it("seo.defaults: robots mode and verification tokens publish; HTML in a token → 422", async () => {
    const res = await saveAndPublish(owner, "seo.defaults", (d) => ({
      ...d,
      robots: "noindex",
      verification: { google: "abc_DEF-123", bing: "" },
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      published: {
        robots: "noindex",
        verification: { google: "abc_DEF-123", bing: "" },
      },
    })
    expect(revalidateTag).toHaveBeenCalledWith("settings:seo.defaults", {
      expire: 0,
    })

    const dto = (await (
      await get(owner, "seo.defaults")
    ).json()) as GrowthSettingsDto
    const bad = await adminRequest("/marketing/seo.defaults/draft", {
      cookie: owner,
      method: "PUT",
      json: {
        draft: {
          ...(dto.draft as object),
          verification: { google: '"><script>x</script>', bing: "" },
        },
        version: dto.version,
      },
    })
    expect(bad.status).toBe(422)
    expect(
      Object.keys(
        (
          (await bad.json()) as {
            error: { fieldErrors: Record<string, string[]> }
          }
        ).error.fieldErrors
      )
    ).toEqual(["verification.google"])
  })

  it("authorises before validating the body (403/404, never 422)", async () => {
    const send = (cookie: string, path: string, json: unknown) =>
      adminRequest(`/marketing/${path}`, { cookie, method: "PUT", json })
    expect((await send(admin, "customCode/draft", { draft: 1 })).status).toBe(
      403
    )
    expect((await send(viewer, "consent/draft", {})).status).toBe(403)
    expect((await send(owner, "nope/draft", {})).status).toBe(404)
    expect((await send(owner, "customCode/draft", {})).status).toBe(422)
  })
})

// Final review I1: a tag ID loads third-party script (a GTM container can
// ship Custom HTML) on the admin's origin, so changing one needs the
// owner-only customCode:update, on every path that writes the draft or
// publishes it. The enable toggle stays with marketing.
describe("tracking tag IDs are owner-only (final review I1)", () => {
  const draftOf = async (cookie: string) =>
    (await (await get(cookie, "tracking")).json()) as GrowthSettingsDto

  const putDraft = (cookie: string, draft: unknown, version: number) =>
    adminRequest("/marketing/tracking/draft", {
      cookie,
      method: "PUT",
      json: { draft, version },
    })

  it("marketer changing any tag ID in a draft → 403", async () => {
    for (const change of [
      { gtmId: "GTM-EVIL1" },
      { ga4Id: "G-EVIL1" },
      { metaPixelId: "123456" },
    ]) {
      const dto = await draftOf(marketer)
      const res = await putDraft(
        marketer,
        { ...(dto.draft as object), ...change },
        dto.version
      )
      expect(res.status, JSON.stringify(change)).toBe(403)
    }
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "tracking"))
    expect(row!.draft).toMatchObject({
      gtmId: null,
      ga4Id: null,
      metaPixelId: null,
    })
  })

  it("marketer toggles tracking and edits the consent copy → 200", async () => {
    const toggled = await saveAndPublish(marketer, "tracking", (d) => ({
      ...d,
      enabled: true,
    }))
    expect(toggled.status).toBe(200)
    const copy = await saveAndPublish(marketer, "consent", (d) => ({
      ...d,
      title: "Cookies on this site",
    }))
    expect(copy.status).toBe(200)
  })

  it("marketer keeps an owner's IDs while editing other fields → 200", async () => {
    const byOwner = await saveAndPublish(owner, "tracking", (d) => ({
      ...d,
      gtmId: "GTM-OWNER1",
    }))
    expect(byOwner.status).toBe(200)
    const res = await saveAndPublish(marketer, "tracking", (d) => ({
      ...d,
      enabled: !d.enabled,
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      published: { gtmId: "GTM-OWNER1" },
    })
  })

  it("marketer publishing a draft whose IDs differ from the live ones → 403; owner → 200", async () => {
    await getDb()
      .update(settings)
      .set({
        draft: {
          enabled: true,
          gtmId: "GTM-EVIL1",
          ga4Id: null,
          metaPixelId: null,
        },
      })
      .where(eq(settings.key, "tracking"))
    const { version } = await draftOf(marketer)
    const publish = (cookie: string) =>
      adminRequest("/marketing/tracking/publish", {
        cookie,
        method: "POST",
        json: { version },
      })
    expect((await publish(marketer)).status).toBe(403)
    expect((await publish(owner)).status).toBe(200)
  })

  it("marketer restoring a revision with other IDs → 403; owner → 200", async () => {
    await saveAndPublish(owner, "tracking", (d) => ({
      ...d,
      gtmId: "GTM-OLD1",
    }))
    await saveAndPublish(owner, "tracking", (d) => ({ ...d, gtmId: null }))
    const history = (await (
      await adminRequest("/revisions/settings/tracking", { cookie: marketer })
    ).json()) as { items: { id: string }[] }
    // Newest first: [gtmId null, GTM-OLD1].
    const old = history.items[1]!.id
    const restore = async (cookie: string) =>
      adminRequest("/marketing/tracking/restore", {
        cookie,
        method: "POST",
        json: { revisionId: old, version: (await draftOf(cookie)).version },
      })
    expect((await restore(marketer)).status).toBe(403)
    expect((await restore(owner)).status).toBe(200)
  })
})
