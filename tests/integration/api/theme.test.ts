import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { ThemeDto } from "@/lib/schemas/api/theme"
import { DEFAULT_THEME, type ThemeConfigValue } from "@/lib/theme/schema"
import { getDb } from "@/server/db/client"
import { auditLog, revisions, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let owner: string
let marketer: string
let viewer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  owner = (await signedInUser(["owner"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  revalidateTag.mockClear()
})

const BASE = "/appearance"

async function getTheme(cookie: string): Promise<ThemeDto> {
  const res = await adminRequest(BASE, { cookie })
  expect(res.status).toBe(200)
  return (await res.json()) as ThemeDto
}

const saveDraft = (cookie: string, version: number, draft: unknown) =>
  adminRequest(`${BASE}/draft`, {
    cookie,
    method: "PUT",
    json: { version, draft },
  })

const post = (cookie: string, path: string, json: unknown) =>
  adminRequest(`${BASE}${path}`, { cookie, method: "POST", json })

const withAdmin = (
  theme: ThemeConfigValue,
  admin: Partial<ThemeConfigValue["admin"]>
) => ({ ...theme, admin: { ...theme.admin, ...admin } })

async function countRevisions(entityType: string, entityId: string) {
  const rows = await getDb()
    .select({ id: revisions.id })
    .from(revisions)
    .where(
      and(
        eq(revisions.entityType, entityType),
        eq(revisions.entityId, entityId)
      )
    )
  return rows.length
}

describe("appearance API (theme draft/publish)", () => {
  it("serves the seeded default theme with no draft and no issues", async () => {
    const dto = await getTheme(owner)
    expect(dto.draft).toEqual(DEFAULT_THEME)
    expect(dto.published).toEqual(DEFAULT_THEME)
    expect(dto.version).toBe(1)
    expect(dto.hasDraft).toBe(false)
    expect(dto.issues).toEqual([])
    expect(typeof dto.updatedAt).toBe("string")
  })

  it("owner saves a draft, publish bumps version, writes a revision and audit", async () => {
    const saved = await saveDraft(
      owner,
      1,
      withAdmin(DEFAULT_THEME, { primary: "#1d4ed8" })
    )
    expect(saved.status).toBe(200)
    const draft = (await saved.json()) as ThemeDto
    expect(draft.version).toBe(2)
    expect(draft.hasDraft).toBe(true)
    // Stored canonical (hex in, oklch out).
    expect(draft.draft.admin.primary).toMatch(/^oklch\(/)
    expect(draft.published).toEqual(DEFAULT_THEME)

    const res = await post(owner, "/publish", { version: 2 })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as ThemeDto
    expect(dto.version).toBe(3)
    expect(dto.hasDraft).toBe(false)
    expect(dto.published).toEqual(dto.draft)
    expect(await countRevisions("settings", "theme")).toBe(1)
    expect(revalidateTag).toHaveBeenCalledWith("settings:theme", {
      expire: 0,
    })
    const audits = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "appearance.publish"))
    expect(audits).toHaveLength(1)
    expect(audits[0]!.entityId).toBe("theme")

    const history = await adminRequest("/revisions/settings/theme", {
      cookie: viewer,
    })
    expect(history.status).toBe(200)
    const { items } = (await history.json()) as {
      items: { version: number }[]
    }
    expect(items.map((r) => r.version)).toEqual([3])
  })

  it("stale version → 409 with current", async () => {
    expect(
      (await saveDraft(owner, 1, withAdmin(DEFAULT_THEME, { radius: 0.5 })))
        .status
    ).toBe(200)
    const res = await saveDraft(
      owner,
      1,
      withAdmin(DEFAULT_THEME, { radius: 1 })
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as {
      error: { current: ThemeDto }
    }
    expect(body.error.current.version).toBe(2)
    expect(body.error.current.draft.admin.radius).toBe(0.5)
  })

  it("publish blocked while contrast fails", async () => {
    const saved = await saveDraft(
      owner,
      1,
      withAdmin(DEFAULT_THEME, { primary: "#d4f5c0" })
    )
    expect(saved.status).toBe(200)
    const draft = (await saved.json()) as ThemeDto
    expect(draft.issues.length).toBeGreaterThan(0)

    const res = await post(owner, "/publish", { version: 2 })
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { code: string; fieldErrors: { draft: string[] } }
    }
    expect(body.error.code).toBe("VALIDATION_FAILED")
    expect(body.error.fieldErrors.draft[0]).toMatch(/needs 4.5:1/)
    expect(await countRevisions("settings", "theme")).toBe(0)
    expect((await getTheme(owner)).published).toEqual(DEFAULT_THEME)
  })

  it("a corrupt stored draft: GET falls back with a warning, publish → 422, live unchanged", async () => {
    const live = withAdmin(DEFAULT_THEME, { radius: 0.5 })
    await saveDraft(owner, 1, live)
    expect((await post(owner, "/publish", { version: 2 })).status).toBe(200)
    const before = await getTheme(owner)
    await getDb()
      .update(settings)
      .set({ draft: { admin: { primary: "red;}body{" } } })
      .where(eq(settings.key, "theme"))

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const dto = await getTheme(owner)
      expect(dto.draft).toEqual(DEFAULT_THEME)
      expect(dto.published).toEqual(before.published)
      expect(dto.hasDraft).toBe(true)
      expect(warn).toHaveBeenCalledWith(
        "[theme] stored theme invalid; using default",
        expect.anything()
      )

      const res = await post(owner, "/publish", { version: dto.version })
      expect(res.status).toBe(422)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe("VALIDATION_FAILED")
    } finally {
      warn.mockRestore()
    }
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "theme"))
    expect(row!.published).toEqual(before.published)
    expect(row!.version).toBe(before.version)
    expect(await countRevisions("settings", "theme")).toBe(1)
  })

  it("rejects a colour injection", async () => {
    for (const primary of [
      "red;}body{",
      "red;}body{display:none",
      "oklch(1 0 0);--x:1",
      "var(--a)",
      "#".padEnd(10_000, "a"),
    ]) {
      const res = await saveDraft(
        owner,
        1,
        withAdmin(DEFAULT_THEME, { primary })
      )
      expect(res.status, primary.slice(0, 40)).toBe(422)
    }
    const injectedToken = await saveDraft(owner, 1, {
      ...DEFAULT_THEME,
      site: { ...DEFAULT_THEME.site, tokens: { "brand-navy": "red;}" } },
    })
    expect(injectedToken.status).toBe(422)
    expect((await getTheme(owner)).version).toBe(1)
  })

  it("reset admin to evergreen keeps site", async () => {
    const custom = {
      site: { ...DEFAULT_THEME.site, brand: "#1d4ed8" },
      admin: { ...DEFAULT_THEME.admin, primary: "#1d4ed8", radius: 1 },
    }
    const saved = (await (await saveDraft(owner, 1, custom)).json()) as ThemeDto
    const res = await post(owner, "/reset", {
      version: saved.version,
      preset: "evergreen",
      scope: "admin",
    })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as ThemeDto
    expect(dto.version).toBe(3)
    expect(dto.draft.site).toEqual(saved.draft.site)
    expect(dto.draft.admin).toEqual({
      ...DEFAULT_THEME.admin,
      preset: "evergreen",
    })
    const audits = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "appearance.reset"))
    expect(audits).toHaveLength(1)
  })

  it("reset both replaces site and admin; stale reset → 409", async () => {
    const saved = (await (
      await saveDraft(owner, 1, withAdmin(DEFAULT_THEME, { radius: 1 }))
    ).json()) as ThemeDto
    const stale = await post(owner, "/reset", {
      version: 1,
      preset: "evergreen",
      scope: "both",
    })
    expect(stale.status).toBe(409)
    const res = await post(owner, "/reset", {
      version: saved.version,
      preset: "evergreen",
      scope: "both",
    })
    const dto = (await res.json()) as ThemeDto
    expect(dto.draft.site.preset).toBe("evergreen")
    expect(dto.draft.admin.preset).toBe("evergreen")
    expect(dto.draft.admin.radius).toBe(DEFAULT_THEME.admin.radius)
  })

  it("discard puts the published theme back into the draft", async () => {
    const saved = (await (
      await saveDraft(owner, 1, withAdmin(DEFAULT_THEME, { mode: "dark" }))
    ).json()) as ThemeDto
    expect(saved.hasDraft).toBe(true)
    const stale = await post(owner, "/discard", { version: 1 })
    expect(stale.status).toBe(409)
    const res = await post(owner, "/discard", { version: saved.version })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as ThemeDto
    expect(dto.draft).toEqual(DEFAULT_THEME)
    expect(dto.hasDraft).toBe(false)
  })

  it("restores a published revision into the draft", async () => {
    await saveDraft(owner, 1, withAdmin(DEFAULT_THEME, { radius: 0.5 }))
    await post(owner, "/publish", { version: 2 })
    const history = await adminRequest("/revisions/settings/theme", {
      cookie: owner,
    })
    const [revision] = ((await history.json()) as { items: { id: string }[] })
      .items
    await saveDraft(owner, 3, withAdmin(DEFAULT_THEME, { radius: 1 }))
    const res = await post(owner, "/restore", {
      version: 4,
      revisionId: revision!.id,
    })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as ThemeDto
    expect(dto.version).toBe(5)
    expect(dto.draft.admin.radius).toBe(0.5)
  })

  it("marketer reads, cannot save (403); viewer reads; author 403 on GET", async () => {
    expect((await adminRequest(BASE, { cookie: marketer })).status).toBe(200)
    expect((await adminRequest(BASE, { cookie: viewer })).status).toBe(200)
    expect((await saveDraft(marketer, 1, DEFAULT_THEME)).status).toBe(403)
    expect((await post(viewer, "/publish", { version: 1 })).status).toBe(403)
    expect(
      (
        await post(marketer, "/reset", {
          version: 1,
          preset: "evergreen",
          scope: "both",
        })
      ).status
    ).toBe(403)
    const author = (await signedInUser(["author"])).cookie
    expect((await adminRequest(BASE, { cookie: author })).status).toBe(403)
    expect(
      (await adminRequest("/revisions/settings/theme", { cookie: author }))
        .status
    ).toBe(403)
    const editor = (await signedInUser(["editor"])).cookie
    expect((await adminRequest(BASE, { cookie: editor })).status).toBe(200)
    expect((await saveDraft(editor, 1, DEFAULT_THEME)).status).toBe(403)
  })

  it("theme is not served by the Settings API", async () => {
    expect(
      (await adminRequest("/settings/theme", { cookie: owner })).status
    ).toBe(404)
  })
})
