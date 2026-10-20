import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Hono runs outside Next here: record invalidations instead of revalidating.
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { collectMediaFields } from "@/lib/media"
import type { PageDto, RevisionSummary } from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import { auditLog, media, pages, revisions } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type HomeDraft = {
  hero: { heading: string; backgroundImage: { mediaId: string } }
}

let editor: string
let viewer: string
let marketer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  revalidateTag.mockClear()
})

async function getHome(cookie = editor) {
  const res = await adminRequest("/pages/home", { cookie })
  expect(res.status).toBe(200)
  return (await res.json()) as PageDto
}

function withHeading(page: PageDto, heading: string) {
  const draft = structuredClone(page.draft) as HomeDraft
  draft.hero.heading = heading
  return draft
}

const saveDraft = (cookie: string, draft: unknown, version: number) =>
  adminRequest("/pages/home/draft", {
    cookie,
    method: "PUT",
    json: { draft, version },
  })

describe("pages API + versioning (master 4.2)", () => {
  it("lists the eight pages in site order with status", async () => {
    const res = await adminRequest("/pages", { cookie: viewer })
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as { items: PageDto[] }
    expect(items.map((p) => p.key)).toEqual([
      "home",
      "about",
      "services",
      "team",
      "blog",
      "contact",
      "privacy",
      "terms",
    ])
    expect(items[0]).toMatchObject({
      label: "Home",
      path: "/",
      template: "home",
      version: 1,
      status: "published",
      dirty: false,
    })
    expect(items[0]).not.toHaveProperty("draft")
  })

  it("saves a draft with the current version → version + 1, site untouched", async () => {
    const home = await getHome()
    const res = await saveDraft(editor, withHeading(home, "Draft heading"), 1)
    expect(res.status).toBe(200)
    const saved = (await res.json()) as PageDto
    expect(saved.version).toBe(2)
    expect(saved.dirty).toBe(true)
    expect((saved.draft as HomeDraft).hero.heading).toBe("Draft heading")
    expect((saved.published as HomeDraft).hero.heading).toBe(
      "Security Partners Ltd."
    )
    expect(saved.updatedBy?.id).toBeTruthy()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("rejects a stale version with 409 and the current state (Review Focus 2)", async () => {
    const home = await getHome()
    // Editor A saves first (version 1 → 2).
    expect(
      (await saveDraft(editor, withHeading(home, "A wins"), 1)).status
    ).toBe(200)
    // Editor B still holds version 1.
    const res = await saveDraft(editor, withHeading(home, "B loses"), 1)
    expect(res.status).toBe(409)
    const body = (await res.json()) as {
      error: { code: string; current: PageDto }
    }
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.current.version).toBe(2)
    expect((body.error.current.draft as HomeDraft).hero.heading).toBe("A wins")
    // Nothing was overwritten.
    expect(((await getHome()).draft as HomeDraft).hero.heading).toBe("A wins")
  })

  it("validates the draft against the template: 422 with field paths", async () => {
    const home = await getHome()
    const res = await saveDraft(editor, withHeading(home, ""), 1)
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(body.error.fieldErrors).toEqual({ "hero.heading": ["Required"] })
    const missing = await saveDraft(editor, { hero: {} }, 1)
    expect(
      Object.keys(((await missing.json()) as typeof body).error.fieldErrors)
    ).toContain("hero.eyebrow")
  })

  it("rejects a reference to an image that is not in the library (422)", async () => {
    const home = await getHome()
    const draft = withHeading(home, "x")
    draft.hero.backgroundImage = {
      mediaId: "00000000-0000-7000-8000-000000000999",
    }
    const res = await saveDraft(editor, draft, 1)
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toEqual([
      "hero.backgroundImage",
    ])
  })

  it("publishes: draft → published, revision, audit, media usages, invalidate page:home", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "Published heading"), 1)
    const res = await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    expect(res.status).toBe(200)
    const page = (await res.json()) as PageDto
    expect(page).toMatchObject({
      version: 3,
      status: "published",
      dirty: false,
    })
    expect((page.published as HomeDraft).hero.heading).toBe("Published heading")
    expect(page.publishedAt).not.toBeNull()
    expect(revalidateTag).toHaveBeenCalledWith("page:home", { expire: 0 })

    const db = getDb()
    const revs = await db
      .select()
      .from(revisions)
      .where(
        and(eq(revisions.entityType, "page"), eq(revisions.entityId, "home"))
      )
    expect(revs.map((r) => r.version)).toEqual([3])
    const audit = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, "home"))
    expect(audit.map((a) => a.action).sort()).toEqual([
      "page.draft_saved",
      "page.published",
    ])
    const usages = await listMediaUsagesFor(db, "page", "home")
    const [hero] = await db
      .select()
      .from(media)
      .where(eq(media.key, "/images/hero.jpg"))
    expect(usages).toContainEqual({
      mediaId: hero.id,
      field: "hero.backgroundImage",
    })
  })

  it("publish with a stale version → 409, nothing published", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "Newer"), 1)
    const res = await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 1 },
    })
    expect(res.status).toBe(409)
    const [row] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "home"))
    expect((row.published as HomeDraft).hero.heading).toBe(
      "Security Partners Ltd."
    )
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("concurrent publishes of one version: one wins, the other gets 409", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "Race"), 1)
    const publishV2 = () =>
      adminRequest("/pages/home/publish", {
        cookie: editor,
        method: "POST",
        json: { version: 2 },
      })
    const results = await Promise.all([publishV2(), publishV2()])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const revs = await getDb()
      .select({ version: revisions.version })
      .from(revisions)
      .where(
        and(eq(revisions.entityType, "page"), eq(revisions.entityId, "home"))
      )
    expect(revs.map((r) => r.version)).toEqual([3])
  })

  it("a leftover revision row at the publish version → logged 500, rolled back", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "Clash"), 1)
    // A leftover revision already holds the version the publish would write;
    // the page itself did not move on, so this is a data fault, not a race.
    await getDb()
      .insert(revisions)
      .values({ entityType: "page", entityId: "home", version: 3, data: {} })
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    expect(res.status).toBe(500)
    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining("page/home: revision 3 already exists")
    )
    errors.mockRestore()
    expect(revalidateTag).not.toHaveBeenCalled()
    const [row] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "home"))
    expect(row.version).toBe(2)
    expect((row.published as HomeDraft).hero.heading).toBe(
      "Security Partners Ltd."
    )
  })

  it("lists revisions and restores one into the draft", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "First"), 1)
    await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    await saveDraft(editor, withHeading(home, "Second"), 3)
    await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 4 },
    })

    const list = await adminRequest("/revisions/page/home", { cookie: viewer })
    const { items } = (await list.json()) as { items: RevisionSummary[] }
    expect(items.map((r) => r.version)).toEqual([5, 3])
    expect(items[0].actor?.name).toBeTruthy()

    const detail = await adminRequest(`/revisions/page/home/${items[1].id}`, {
      cookie: viewer,
    })
    expect(
      ((await detail.json()) as { data: HomeDraft }).data.hero.heading
    ).toBe("First")

    const restored = await adminRequest("/pages/home/restore", {
      cookie: editor,
      method: "POST",
      json: { revisionId: items[1].id, version: 5 },
    })
    expect(restored.status).toBe(200)
    const page = (await restored.json()) as PageDto
    expect(page.version).toBe(6)
    expect((page.draft as HomeDraft).hero.heading).toBe("First")
    expect((page.published as HomeDraft).hero.heading).toBe("Second")
    expect(page.dirty).toBe(true)

    const wrong = await adminRequest("/pages/about/restore", {
      cookie: editor,
      method: "POST",
      json: { revisionId: items[1].id, version: 1 },
    })
    expect(wrong.status).toBe(404)
  })

  it("enforces page permissions", async () => {
    const home = await getHome()
    expect((await saveDraft(viewer, withHeading(home, "x"), 1)).status).toBe(
      403
    )
    expect((await adminRequest("/pages", { cookie: marketer })).status).toBe(
      200
    )
    expect(
      (
        await adminRequest("/pages/home/publish", {
          cookie: marketer,
          method: "POST",
          json: { version: 1 },
        })
      ).status
    ).toBe(403)
    expect((await adminRequest("/pages/nope", { cookie: editor })).status).toBe(
      422
    )
    expect(
      (await adminRequest("/revisions/settings/site", { cookie: marketer }))
        .status
    ).toBe(403)
    const author = (await signedInUser(["author"])).cookie
    expect((await adminRequest("/pages", { cookie: author })).status).toBe(403)
  })
})

describe("fix round 1: audit coalescing, version-first checks, usages", () => {
  const draftAudits = () =>
    getDb()
      .select({ actorId: auditLog.actorId, diff: auditLog.diff })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "page.draft_saved"),
          eq(auditLog.entityId, "home")
        )
      )
      .orderBy(auditLog.createdAt)

  it("coalesces rapid draft saves by one actor into one audit row", async () => {
    const home = await getHome()
    for (const [i, version] of [1, 2, 3].entries())
      expect(
        (await saveDraft(editor, withHeading(home, `Save ${i}`), version))
          .status
      ).toBe(200)
    let rows = await draftAudits()
    expect(rows).toHaveLength(1)
    expect(rows[0].diff).toMatchObject({ saves: 3, version: 4 })
    expect(typeof (rows[0].diff as { lastSavedAt: unknown }).lastSavedAt).toBe(
      "string"
    )

    // Another editor's save starts its own row.
    const other = await signedInUser(["editor"])
    expect(
      (await saveDraft(other.cookie, withHeading(home, "Other"), 4)).status
    ).toBe(200)
    rows = await draftAudits()
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({
      actorId: other.user.id,
      diff: { saves: 1, version: 5 },
    })
  })

  it("a publish in between starts a new draft_saved row", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "One"), 1)
    await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    await saveDraft(editor, withHeading(home, "Two"), 3)
    const rows = await draftAudits()
    expect(rows.map((r) => (r.diff as { saves: number }).saves)).toEqual([1, 1])
  })

  it("checks the version before validating (save and publish)", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "Newer"), 1)
    // Stale and invalid → 409, not 422.
    const stale = await saveDraft(editor, { hero: {} }, 1)
    expect(stale.status).toBe(409)
    expect(
      ((await stale.json()) as { error: { current: PageDto } }).error.current
        .version
    ).toBe(2)

    // An invalid stored draft: a stale publish still answers 409 first.
    await getDb()
      .update(pages)
      .set({ draft: { hero: {} } })
      .where(eq(pages.key, "home"))
    const stalePublish = await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 1 },
    })
    expect(stalePublish.status).toBe(409)
    const currentPublish = await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    expect(currentPublish.status).toBe(422)
  })

  it("restore: stale version → 409; a revision the schema rejects → 422", async () => {
    const [bad] = await getDb()
      .insert(revisions)
      .values({
        entityType: "page",
        entityId: "home",
        version: 99,
        data: { hero: {} },
      })
      .returning({ id: revisions.id })
    const restore = (version: number) =>
      adminRequest("/pages/home/restore", {
        cookie: editor,
        method: "POST",
        json: { revisionId: bad.id, version },
      })
    const stale = await restore(7)
    expect(stale.status).toBe(409)
    expect(
      ((await stale.json()) as { error: { current: PageDto } }).error.current
        .version
    ).toBe(1)
    const invalid = await restore(1)
    expect(invalid.status).toBe(422)
    const body = (await invalid.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toContain("hero.heading")
    expect((await getHome()).version).toBe(1)
  })

  it("media_usages is exactly draft ∪ published; a replaced image drops its row", async () => {
    const db = getDb()
    const [hero] = await db
      .select()
      .from(media)
      .where(eq(media.key, "/images/hero.jpg"))
    const [banner] = await db
      .select()
      .from(media)
      .where(eq(media.key, "/images/banner.png"))
    const fieldsOf = (...values: unknown[]) =>
      [
        ...new Set(
          values
            .flatMap((v) => collectMediaFields(v))
            .map((u) => `${u.mediaId} ${u.field}`)
        ),
      ].sort()
    const usagesNow = async () =>
      (await listMediaUsagesFor(db, "page", "home"))
        .map((u) => `${u.mediaId} ${u.field}`)
        .sort()

    const home = await getHome()
    const draft = withHeading(home, "New image")
    draft.hero.backgroundImage = { mediaId: banner.id }
    const saved = (await (await saveDraft(editor, draft, 1)).json()) as PageDto
    // Draft uses the banner, the live page still uses the hero image.
    expect(await usagesNow()).toEqual(fieldsOf(saved.draft, saved.published))
    expect(await usagesNow()).toContain(`${hero.id} hero.backgroundImage`)
    expect(await usagesNow()).toContain(`${banner.id} hero.backgroundImage`)

    const published = (await (
      await adminRequest("/pages/home/publish", {
        cookie: editor,
        method: "POST",
        json: { version: 2 },
      })
    ).json()) as PageDto
    expect(await usagesNow()).toEqual(fieldsOf(published.published))
    expect(await usagesNow()).not.toContain(`${hero.id} hero.backgroundImage`)
  })
})
