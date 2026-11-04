import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Hono runs outside Next here: record invalidations instead of revalidating.
const { revalidateTag, draft } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  draft: { isEnabled: false },
}))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  draftMode: async () => draft,
}))

import type { RevisionSummary } from "@/lib/schemas/api/content"
import type {
  LegalPageDto,
  LegalPageListItem,
} from "@/lib/schemas/api/legal-pages"
import { getDb } from "@/server/db/client"
import { auditLog, legalPages, redirects } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  getLegalLinks,
  getPublishedLegalPage,
  isPublishedLegalSlug,
} from "@/server/modules/legal-pages/queries"
import { resolvePublicPath } from "@/server/modules/redirects/resolve"
import { listSitemapEntries } from "@/server/modules/seo/queries"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type ErrorBody = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    current?: LegalPageDto
  }
}

let editor: string
let viewer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  revalidateTag.mockClear()
  draft.isEnabled = false
})

const post = (json: unknown, cookie = editor) =>
  adminRequest("/legal-pages", { cookie, method: "POST", json })

async function create(slug = "cookie-policy", title = "Cookie Policy") {
  const res = await post({ title, slug })
  expect(res.status).toBe(201)
  return (await res.json()) as LegalPageDto
}

const saveDraft = (id: string, json: unknown, cookie = editor) =>
  adminRequest(`/legal-pages/${id}/draft`, { cookie, method: "PUT", json })

const publish = (id: string, version: number, cookie = editor) =>
  adminRequest(`/legal-pages/${id}/publish`, {
    cookie,
    method: "POST",
    json: { version },
  })

const meta = (id: string, json: unknown, cookie = editor) =>
  adminRequest(`/legal-pages/${id}/meta`, { cookie, method: "PATCH", json })

const list = async (cookie = editor) =>
  (
    (await (await adminRequest("/legal-pages", { cookie })).json()) as {
      items: LegalPageListItem[]
    }
  ).items

async function createAndPublish(slug: string, title: string) {
  const page = await create(slug, title)
  const res = await publish(page.id, page.version)
  expect(res.status).toBe(200)
  return (await res.json()) as LegalPageDto
}

describe("create", () => {
  it("starts a draft at /<slug> from the Privacy banner, last in the footer order", async () => {
    const first = await create("cookie-policy", "Cookie Policy")
    expect(first).toMatchObject({
      slug: "cookie-policy",
      title: "Cookie Policy",
      path: "/cookie-policy",
      status: "draft",
      sortOrder: 0,
      published: null,
    })
    expect(first.draft.hero).toMatchObject({
      crumb: "Cookie Policy",
      title: "Cookie Policy",
    })
    expect(first.draft.hero.image.mediaId).toBeTruthy()
    const second = await create("acceptable-use", "Acceptable Use")
    expect(second.sortOrder).toBe(1)
    expect((await list()).map((p) => p.slug)).toEqual([
      "cookie-policy",
      "acceptable-use",
    ])
    const audit = await getDb().select().from(auditLog)
    expect(audit.map((a) => a.action)).toContain("legal-page.created")
  })

  it.each(["about", "privacy", "terms", "p", "admin", "api", "sitemap"])(
    "refuses the reserved address /%s",
    async (slug) => {
      const res = await post({ title: "X", slug })
      expect(res.status).toBe(422)
    }
  )

  it.each(["Cookie Policy", "cookie_policy", "-cookie", "cookie-", "a/b", ""])(
    "refuses the malformed address %j",
    async (slug) => {
      expect((await post({ title: "X", slug })).status).toBe(422)
    }
  )

  it("refuses a duplicate address with a field error", async () => {
    await create()
    const res = await post({ title: "Again", slug: "cookie-policy" })
    expect(res.status).toBe(409)
    expect(
      ((await res.json()) as ErrorBody).error.fieldErrors?.slug
    ).toBeTruthy()
  })

  it("refuses an address a redirect already starts at, naming the redirect", async () => {
    await getDb()
      .insert(redirects)
      .values({ fromPath: "/old-cookies", toPath: "/", code: 301 })
    const res = await post({ title: "Old", slug: "old-cookies" })
    expect(res.status).toBe(409)
    const body = (await res.json()) as ErrorBody
    expect(body.error.message).toContain("/old-cookies")
    expect(body.error.fieldErrors?.slug?.[0]).toContain("Remove that redirect")
  })

  it("needs page:create (a viewer cannot)", async () => {
    expect((await post({ title: "X", slug: "x-page" }, viewer)).status).toBe(
      403
    )
  })
})

describe("draft, publish and the public side", () => {
  it("keeps drafts private: not live, not in the footer, not in the sitemap", async () => {
    const page = await create()
    expect(await isPublishedLegalSlug("cookie-policy")).toBe(false)
    expect(await getPublishedLegalPage("cookie-policy")).toBeNull()
    expect(await getLegalLinks()).toEqual([])
    expect((await listSitemapEntries()).map((e) => e.path)).not.toContain(
      "/cookie-policy"
    )
    // A previewer (draft mode) does see the draft.
    expect((await getPublishedLegalPage("cookie-policy", true))?.title).toBe(
      "Cookie Policy"
    )
    expect(page.status).toBe("draft")
  })

  it("rejects a draft that fails the legal template (field errors)", async () => {
    const page = await create()
    const res = await saveDraft(page.id, {
      version: page.version,
      draft: { ...page.draft, hero: { ...page.draft.hero, title: "" } },
    })
    expect(res.status).toBe(422)
    expect(
      ((await res.json()) as ErrorBody).error.fieldErrors?.["hero.title"]
    ).toBeTruthy()
  })

  it("publishing makes it live, linked from the footer and in the sitemap", async () => {
    const page = await create()
    const edited = (await (
      await saveDraft(page.id, {
        version: page.version,
        draft: {
          ...page.draft,
          hero: { ...page.draft.hero, description: "How we use cookies." },
        },
      })
    ).json()) as LegalPageDto
    const live = (await (
      await publish(page.id, edited.version)
    ).json()) as LegalPageDto
    expect(live.status).toBe("published")
    expect(live.published?.hero.description).toBe("How we use cookies.")
    expect(live.publishedAt).toBeTruthy()

    expect(await isPublishedLegalSlug("cookie-policy")).toBe(true)
    const found = await getPublishedLegalPage("cookie-policy")
    expect(found?.doc.hero.description).toBe("How we use cookies.")
    // "Last updated" is the publish time.
    expect(found?.updatedAt.toISOString()).toBe(live.publishedAt)
    expect(await getLegalLinks()).toEqual([
      { slug: "cookie-policy", title: "Cookie Policy" },
    ])
    expect((await listSitemapEntries()).map((e) => e.path)).toContain(
      "/cookie-policy"
    )
    expect(revalidateTag).toHaveBeenCalledWith("legal-pages", { expire: 0 })
  })

  it("serves only published content: later draft edits stay hidden", async () => {
    const live = await createAndPublish("cookie-policy", "Cookie Policy")
    const saved = (await (
      await saveDraft(live.id, {
        version: live.version,
        draft: {
          ...live.draft,
          hero: { ...live.draft.hero, description: "Not yet." },
        },
      })
    ).json()) as LegalPageDto
    expect(saved.dirty).toBe(true)
    expect(
      (await getPublishedLegalPage("cookie-policy"))?.doc.hero.description
    ).not.toBe("Not yet.")
  })

  it("needs page:publish (a viewer cannot) and writes a revision", async () => {
    const page = await create()
    expect((await publish(page.id, page.version, viewer)).status).toBe(403)
    await publish(page.id, page.version)
    const res = await adminRequest(`/revisions/legal-page/${page.id}`, {
      cookie: editor,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: RevisionSummary[] }
    expect(body.items.length).toBeGreaterThan(0)
  })

  it("answers an address in the proxy: live passes, a draft or unknown one is a real 404", async () => {
    await createAndPublish("cookie-policy", "Cookie Policy")
    await create("secret-terms", "Secret Terms")
    expect(await resolvePublicPath("/cookie-policy", { draft: false })).toEqual(
      {
        kind: "pass",
      }
    )
    expect(await resolvePublicPath("/secret-terms", { draft: false })).toEqual({
      kind: "missing",
    })
    expect(await resolvePublicPath("/nothing-here", { draft: false })).toEqual({
      kind: "missing",
    })
    // A previewer's draft mode may open the draft.
    expect(await resolvePublicPath("/secret-terms", { draft: true })).toEqual({
      kind: "pass",
    })
    // Fixed pages and deeper paths are untouched.
    expect(await resolvePublicPath("/privacy", { draft: false })).toEqual({
      kind: "pass",
    })
  })

  it("a live legal address cannot become a redirect source", async () => {
    await createAndPublish("cookie-policy", "Cookie Policy")
    const marketer = (await signedInUser(["marketer"])).cookie
    const res = await adminRequest("/redirects", {
      cookie: marketer,
      method: "POST",
      json: { fromPath: "/cookie-policy", toPath: "/", code: 301 },
    })
    expect(res.status).toBe(422)
  })
})

describe("title and address", () => {
  it("renaming a published page records a 301 from the old address", async () => {
    const live = await createAndPublish("cookie-policy", "Cookie Policy")
    revalidateTag.mockClear()
    const res = await meta(live.id, { version: live.version, slug: "cookies" })
    expect(res.status).toBe(200)
    const moved = (await res.json()) as LegalPageDto
    expect(moved.path).toBe("/cookies")
    const [redirect] = await getDb()
      .select({ fromPath: redirects.fromPath, toPath: redirects.toPath })
      .from(redirects)
      .where(eq(redirects.fromPath, "/cookie-policy"))
    expect(redirect).toEqual({ fromPath: "/cookie-policy", toPath: "/cookies" })
    expect(await isPublishedLegalSlug("cookies")).toBe(true)
    expect(await isPublishedLegalSlug("cookie-policy")).toBe(false)
    expect(revalidateTag).toHaveBeenCalledWith("legal-pages", { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith("redirects", { expire: 0 })
  })

  it("renaming a never-published page records no redirect", async () => {
    const page = await create()
    await meta(page.id, { version: page.version, slug: "cookies" })
    expect(await getDb().select().from(redirects)).toEqual([])
  })

  it("a title change updates the footer link and never touches the last-updated date", async () => {
    const live = await createAndPublish("cookie-policy", "Cookie Policy")
    const res = await meta(live.id, { version: live.version, title: "Cookies" })
    const renamed = (await res.json()) as LegalPageDto
    expect(renamed.title).toBe("Cookies")
    expect(renamed.publishedAt).toBe(live.publishedAt)
    expect(await getLegalLinks()).toEqual([
      { slug: "cookie-policy", title: "Cookies" },
    ])
  })

  it("refuses reserved and taken addresses, a stale version, and an empty change", async () => {
    const a = await create("one-page", "One")
    const b = await create("two-page", "Two")
    expect(
      (await meta(a.id, { version: a.version, slug: "terms" })).status
    ).toBe(422)
    expect(
      (await meta(a.id, { version: a.version, slug: "two-page" })).status
    ).toBe(409)
    expect((await meta(b.id, { version: 99, title: "X" })).status).toBe(409)
    expect((await meta(b.id, { version: b.version })).status).toBe(422)
  })
})

describe("order", () => {
  it("reorders the footer exactly as sent and keeps the dates", async () => {
    const a = await createAndPublish("page-a", "A")
    const b = await createAndPublish("page-b", "B")
    const c = await createAndPublish("page-c", "C")
    const res = await adminRequest("/legal-pages/order", {
      cookie: editor,
      method: "PUT",
      json: { ids: [c.id, a.id, b.id] },
    })
    expect(res.status).toBe(200)
    expect(
      ((await res.json()) as { items: LegalPageListItem[] }).items.map(
        (p) => p.slug
      )
    ).toEqual(["page-c", "page-a", "page-b"])
    expect((await getLegalLinks()).map((l) => l.slug)).toEqual([
      "page-c",
      "page-a",
      "page-b",
    ])
    // Moving is not editing: publish dates and versions are unchanged.
    const [row] = await getDb()
      .select()
      .from(legalPages)
      .where(eq(legalPages.id, a.id))
    expect(row.version).toBe(a.version)
    expect(row.publishedAt?.toISOString()).toBe(a.publishedAt)
  })

  it("refuses an order that is not exactly the existing pages", async () => {
    const a = await create("page-a", "A")
    await create("page-b", "B")
    const send = (ids: string[]) =>
      adminRequest("/legal-pages/order", {
        cookie: editor,
        method: "PUT",
        json: { ids },
      })
    expect((await send([a.id])).status).toBe(422)
    expect((await send([a.id, a.id])).status).toBe(422)
    expect(
      (await send([a.id, "0198f6a0-0000-7000-8000-000000000000"])).status
    ).toBe(422)
  })

  it("needs page:update (a viewer cannot)", async () => {
    const a = await create()
    const res = await adminRequest("/legal-pages/order", {
      cookie: viewer,
      method: "PUT",
      json: { ids: [a.id] },
    })
    expect(res.status).toBe(403)
  })
})

describe("delete", () => {
  it("removes the page, its footer link and its address", async () => {
    const live = await createAndPublish("cookie-policy", "Cookie Policy")
    revalidateTag.mockClear()
    expect(
      (
        await adminRequest(`/legal-pages/${live.id}`, {
          cookie: viewer,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
    const res = await adminRequest(`/legal-pages/${live.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(res.status).toBe(200)
    expect(await isPublishedLegalSlug("cookie-policy")).toBe(false)
    expect(await getLegalLinks()).toEqual([])
    expect(await list()).toEqual([])
    expect(
      (await adminRequest(`/legal-pages/${live.id}`, { cookie: editor })).status
    ).toBe(404)
    expect(revalidateTag).toHaveBeenCalledWith("legal-pages", { expire: 0 })
  })
})
