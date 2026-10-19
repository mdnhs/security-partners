import { and, eq } from "drizzle-orm"
import sharp from "sharp"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

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

import type {
  BuilderPageDto,
  BuilderPageListItem,
} from "@/lib/schemas/api/builder-pages"
import type { RevisionSummary } from "@/lib/schemas/api/content"
import type { MediaItem } from "@/lib/schemas/api/media"
import type { SeoEntry } from "@/lib/schemas/api/seo"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { auditLog, builderPages, redirects } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { diskStorage } from "@/server/lib/storage"
import {
  getPublishedBuilderPage,
  isPublishedBuilderSlug,
  newsletterBlockPublished,
} from "@/server/modules/builder-pages/queries"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, ORIGIN, signedInUser } from "../helpers/auth"

type ErrorBody = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    current?: BuilderPageDto
  }
}

let editor: string
let marketer: string
let viewer: string
let author: string
const created: string[] = []

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  author = (await signedInUser(["author"])).cookie
  revalidateTag.mockClear()
  draft.isEnabled = false
})
afterAll(async () => {
  for (const key of created) await diskStorage().delete(key)
})

const post = (json: unknown, cookie = editor) =>
  adminRequest("/builder-pages", { cookie, method: "POST", json })

async function create(slug = "landing", title = "Landing") {
  const res = await post({ title, slug })
  expect(res.status).toBe(201)
  return (await res.json()) as BuilderPageDto
}

const saveDraft = (id: string, json: unknown, cookie = editor) =>
  adminRequest(`/builder-pages/${id}/draft`, { cookie, method: "PUT", json })

const publish = (id: string, version: number, cookie = editor) =>
  adminRequest(`/builder-pages/${id}/publish`, {
    cookie,
    method: "POST",
    json: { version },
  })

async function uploadPng(color = "#0d1b36"): Promise<string> {
  const bytes = await sharp({
    create: { width: 32, height: 16, channels: 3, background: color },
  })
    .png()
    .toBuffer()
  const form = new FormData()
  form.append("file", new File([new Uint8Array(bytes)], "hero.png"))
  const res = await app.request("/api/v1/admin/media/upload", {
    method: "POST",
    headers: { origin: ORIGIN, cookie: editor },
    body: form,
  })
  expect(res.status).toBe(201)
  const item = (await res.json()) as MediaItem
  created.push(item.url.replace("/api/v1/media/file/", ""))
  return item.id
}

/** A complete, publishable document: page hero + a text block. */
function completeDoc(page: BuilderPageDto, mediaId: string) {
  const [hero] = page.draft.blocks
  return {
    blocks: [
      {
        ...hero,
        data: {
          image: { mediaId },
          crumb: "Landing",
          title: "Security that shows up",
          description: "Manned guarding across Ireland.",
        },
      },
      {
        id: "text-block-1",
        type: "richtext",
        anchor: "text",
        hidden: false,
        data: {
          doc: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Hello" }],
              },
            ],
          },
        },
      },
    ],
  }
}

async function publishedPage(slug = "landing") {
  const page = await create(slug)
  const mediaId = await uploadPng()
  const saved = await saveDraft(page.id, {
    version: page.version,
    draft: completeDoc(page, mediaId),
  })
  expect(saved.status).toBe(200)
  const res = await publish(
    page.id,
    ((await saved.json()) as BuilderPageDto).version
  )
  expect(res.status).toBe(200)
  return { page: (await res.json()) as BuilderPageDto, mediaId }
}

const redirectRows = () =>
  getDb()
    .select({ fromPath: redirects.fromPath, toPath: redirects.toPath })
    .from(redirects)
    .where(eq(redirects.fromPath, "/p/landing"))

describe("builder pages API (D5.2)", () => {
  it("editor creates /p/landing; duplicate slug 409; marketer 403 on create", async () => {
    const page = await create()
    expect(page).toMatchObject({
      slug: "landing",
      title: "Landing",
      path: "/p/landing",
      version: 1,
      status: "draft",
      published: null,
      seo: {},
    })
    expect(page.draft.blocks).toHaveLength(1)
    expect(page.draft.blocks[0]).toMatchObject({
      type: "hero.page",
      anchor: "hero-page",
      hidden: false,
    })

    const dup = await post({ title: "Again", slug: "landing" })
    expect(dup.status).toBe(409)
    expect(
      ((await dup.json()) as ErrorBody).error.fieldErrors?.slug
    ).toBeTruthy()

    for (const cookie of [marketer, viewer, author])
      expect((await post({ title: "x", slug: "nope" }, cookie)).status).toBe(
        403
      )

    // Readers: viewer and marketer may list; author may not.
    const list = await adminRequest("/builder-pages", { cookie: viewer })
    expect(list.status).toBe(200)
    const { items } = (await list.json()) as { items: BuilderPageListItem[] }
    expect(items).toEqual([
      expect.objectContaining({
        id: page.id,
        slug: "landing",
        path: "/p/landing",
        status: "draft",
        hasUnpublishedChanges: true,
      }),
    ])
    expect(
      (await adminRequest("/builder-pages", { cookie: author })).status
    ).toBe(403)
    expect(
      (await adminRequest(`/builder-pages/${page.id}`, { cookie: marketer }))
        .status
    ).toBe(200)

    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "builder-page.created"))
    expect(audit).toMatchObject({
      entityType: "builder-page",
      entityId: page.id,
    })
  })

  it("two editors creating the same slug at once: one gets 409", async () => {
    const results = await Promise.all([
      post({ title: "A", slug: "race" }),
      post({ title: "B", slug: "race" }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
  })

  it("bad slugs → 422", async () => {
    for (const slug of [
      "",
      "Landing",
      "a/b",
      "a-",
      "x".repeat(61),
      "é",
      "admin",
      "landing/",
      " landing",
    ])
      expect((await post({ title: "x", slug })).status, slug).toBe(422)
    expect((await post({ title: "x", slug: "x".repeat(60) })).status).toBe(201)
    expect((await post({ title: " ", slug: "blank-title" })).status).toBe(422)
  })

  it("draft accepts an incomplete block; publish rejects with blocks.<i> fieldErrors", async () => {
    const page = await create()
    const extra = {
      id: "stats-block-1",
      type: "stats",
      anchor: "stats",
      hidden: false,
      data: { items: [] },
    }
    const saved = await saveDraft(page.id, {
      version: page.version,
      draft: { blocks: [...page.draft.blocks, extra] },
    })
    expect(saved.status).toBe(200)
    const dto = (await saved.json()) as BuilderPageDto
    expect(dto.version).toBe(2)
    expect(dto.draft.blocks).toHaveLength(2)

    // Unknown block types never save, even as a draft.
    const unknown = await saveDraft(page.id, {
      version: dto.version,
      draft: { blocks: [{ ...extra, type: "iframe" }] },
    })
    expect(unknown.status).toBe(422)

    const res = await publish(page.id, dto.version)
    expect(res.status).toBe(422)
    const { error } = (await res.json()) as ErrorBody
    const keys = Object.keys(error.fieldErrors ?? {})
    expect(keys.some((k) => k.startsWith("blocks.0.data."))).toBe(true)
    expect(keys.some((k) => k.startsWith("blocks.1.data."))).toBe(true)
    const [row] = await getDb()
      .select({ published: builderPages.published })
      .from(builderPages)
      .where(eq(builderPages.id, page.id))
    expect(row.published).toBeNull()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("marketer cannot save, publish or delete; viewer cannot either", async () => {
    const page = await create()
    for (const cookie of [marketer, viewer]) {
      expect(
        (await saveDraft(page.id, { version: 1, draft: page.draft }, cookie))
          .status
      ).toBe(403)
      expect((await publish(page.id, 1, cookie)).status).toBe(403)
      expect(
        (
          await adminRequest(`/builder-pages/${page.id}`, {
            cookie,
            method: "DELETE",
          })
        ).status
      ).toBe(403)
      expect(
        (
          await adminRequest(`/builder-pages/${page.id}/meta`, {
            cookie,
            method: "PATCH",
            json: { version: 1, title: "Hijack" },
          })
        ).status
      ).toBe(403)
    }
  })

  it("stale version → 409 with current", async () => {
    const page = await create()
    expect(
      (await saveDraft(page.id, { version: 1, draft: page.draft })).status
    ).toBe(200)
    const stale = await saveDraft(page.id, { version: 1, draft: page.draft })
    expect(stale.status).toBe(409)
    const { error } = (await stale.json()) as ErrorBody
    expect(error.current).toMatchObject({ id: page.id, version: 2 })
    const stalePublish = await publish(page.id, 1)
    expect(stalePublish.status).toBe(409)
    const staleMeta = await adminRequest(`/builder-pages/${page.id}/meta`, {
      cookie: editor,
      method: "PATCH",
      json: { version: 1, title: "Other" },
    })
    expect(staleMeta.status).toBe(409)
  })

  it("publish writes a revision; restore loads it into draft", async () => {
    const { page } = await publishedPage()
    expect(page.status).toBe("published")
    expect(page.published?.blocks).toHaveLength(2)
    expect(revalidateTag).toHaveBeenCalledWith("builder-pages", { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith("builder-page:landing", {
      expire: 0,
    })

    const revs = await adminRequest(`/revisions/builder-page/${page.id}`, {
      cookie: editor,
    })
    expect(revs.status).toBe(200)
    const { items } = (await revs.json()) as { items: RevisionSummary[] }
    expect(items).toHaveLength(1)

    // Change the draft, then restore the published revision.
    const changed = await saveDraft(page.id, {
      version: page.version,
      draft: { blocks: [page.draft.blocks[0]] },
    })
    const after = (await changed.json()) as BuilderPageDto
    expect(after.dirty).toBe(true)
    const restored = await adminRequest(`/builder-pages/${page.id}/restore`, {
      cookie: editor,
      method: "POST",
      json: { version: after.version, revisionId: items[0].id },
    })
    expect(restored.status).toBe(200)
    const dto = (await restored.json()) as BuilderPageDto
    expect(dto.draft).toEqual(page.published)
    expect(dto.dirty).toBe(false)

    // Public read and the proxy's check.
    expect(await isPublishedBuilderSlug("landing")).toBe(true)
    expect(await isPublishedBuilderSlug("nope")).toBe(false)
    const live = await getPublishedBuilderPage("landing")
    expect(live).toMatchObject({ id: page.id, title: "Landing" })
    expect(live?.doc.blocks).toHaveLength(2)
  })

  it("draft mode serves the draft with invalid blocks dropped; unpublished → null", async () => {
    const page = await create("draft-only")
    expect(await getPublishedBuilderPage("draft-only")).toBeNull()
    expect(await isPublishedBuilderSlug("draft-only")).toBe(false)
    draft.isEnabled = true
    const preview = await getPublishedBuilderPage("draft-only")
    // The default hero has no image yet: dropped, not rendered broken.
    expect(preview?.doc.blocks).toEqual([])
    expect(preview?.id).toBe(page.id)
  })

  it("slug change on a published page creates an automatic redirect /p/a → /p/b", async () => {
    const { page } = await publishedPage("landing")
    const res = await adminRequest(`/builder-pages/${page.id}/meta`, {
      cookie: editor,
      method: "PATCH",
      json: { version: page.version, slug: "landing-2", title: "Landing two" },
    })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as BuilderPageDto
    expect(dto).toMatchObject({
      slug: "landing-2",
      title: "Landing two",
      path: "/p/landing-2",
      version: page.version + 1,
    })
    expect(await redirectRows()).toEqual([
      { fromPath: "/p/landing", toPath: "/p/landing-2" },
    ])
    expect(revalidateTag).toHaveBeenCalledWith("redirects", { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith("builder-page:landing-2", {
      expire: 0,
    })

    // The live page's address can't be taken as a redirect source.
    const blocked = await adminRequest("/redirects", {
      cookie: marketer,
      method: "POST",
      json: { fromPath: "/p/landing-2", toPath: "/about", code: 301 },
    })
    expect(blocked.status).toBe(422)

    // Unpublished page: no redirect.
    const other = await create("draft-page")
    const moved = await adminRequest(`/builder-pages/${other.id}/meta`, {
      cookie: editor,
      method: "PATCH",
      json: { version: other.version, slug: "draft-page-2" },
    })
    expect(moved.status).toBe(200)
    const rows = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.fromPath, "/p/draft-page"))
    expect(rows).toEqual([])

    // Slug taken → 409 on slug.
    const taken = await adminRequest(`/builder-pages/${other.id}/meta`, {
      cookie: editor,
      method: "PATCH",
      json: { version: other.version + 1, slug: "landing-2" },
    })
    expect(taken.status).toBe(409)
  })

  it("hero image media cannot be deleted while used (usages RESTRICT)", async () => {
    const { page, mediaId } = await publishedPage()
    const usages = await listMediaUsagesFor(getDb(), "builder-page", page.id)
    expect(usages.map((u) => u.mediaId)).toEqual([mediaId])
    const refused = await adminRequest(`/media/${mediaId}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(refused.status).toBe(409)
    const panel = await adminRequest(`/media/${mediaId}/usages`, {
      cookie: editor,
    })
    const { items } = (await panel.json()) as {
      items: { label: string; href: string | null }[]
    }
    expect(items[0]).toMatchObject({
      label: "Custom page: Landing",
      href: `/admin/pages/custom/${page.id}`,
    })

    // A draft referencing missing media is refused on its field.
    const missing = await saveDraft(page.id, {
      version: page.version,
      draft: completeDoc(page, "0199a000-0000-7000-8000-000000000000"),
    })
    expect(missing.status).toBe(422)

    // Delete the page: usages go, the file can go.
    const del = await adminRequest(`/builder-pages/${page.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(del.status).toBe(200)
    expect(await listMediaUsagesFor(getDb(), "builder-page", page.id)).toEqual(
      []
    )
    expect(
      (
        await adminRequest(`/media/${mediaId}`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(200)
  })

  it("delete with redirectHome creates /p/x → / ; without, nothing", async () => {
    const { page } = await publishedPage("landing")
    const res = await adminRequest(
      `/builder-pages/${page.id}?redirectHome=true`,
      { cookie: editor, method: "DELETE" }
    )
    expect(res.status).toBe(200)
    expect(await redirectRows()).toEqual([
      { fromPath: "/p/landing", toPath: "/" },
    ])
    expect(await isPublishedBuilderSlug("landing")).toBe(false)
    expect(revalidateTag).toHaveBeenCalledWith("builder-page:landing", {
      expire: 0,
    })
    expect(
      (await adminRequest(`/builder-pages/${page.id}`, { cookie: editor }))
        .status
    ).toBe(404)

    await getDb().delete(redirects)
    const second = await publishedPage("landing")
    const plain = await adminRequest(`/builder-pages/${second.page.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(plain.status).toBe(200)
    expect(await redirectRows()).toEqual([])
  })

  it("create with a seed document (copy of a fixed page) stores it as the draft", async () => {
    const mediaId = await uploadPng("#ffffff")
    const seed = {
      blocks: [
        {
          id: "seed-hero-1",
          type: "hero.page",
          anchor: "hero-page",
          hidden: false,
          data: {
            image: { mediaId },
            crumb: "About",
            title: "About us",
            description: "Who we are.",
          },
        },
      ],
    }
    const res = await post({ title: "About copy", slug: "about-copy", seed })
    expect(res.status).toBe(201)
    const page = (await res.json()) as BuilderPageDto
    expect(page.draft).toEqual(seed)
    expect(page.path).toBe("/p/about-copy")
    expect(
      (await listMediaUsagesFor(getDb(), "builder-page", page.id)).map(
        (u) => u.mediaId
      )
    ).toEqual([mediaId])
    // The fixed About page is untouched (copy never replaces it).
    const about = await adminRequest("/pages/about", { cookie: editor })
    expect(about.status).toBe(200)
  })

  it("SEO uses /seo/entries/builder/:id (seo:update); usages kept", async () => {
    const { page, mediaId } = await publishedPage()
    const res = await adminRequest(`/seo/entries/builder/${page.id}`, {
      cookie: marketer,
      method: "PUT",
      json: { seo: { title: "Landing | SP", ogImage: { mediaId } } },
    })
    expect(res.status).toBe(200)
    const entry = (await res.json()) as SeoEntry
    expect(entry).toMatchObject({
      kind: "builder",
      id: page.id,
      name: "Landing",
      path: "/p/landing",
      published: true,
    })
    expect(revalidateTag).toHaveBeenCalledWith("builder-page:landing", {
      expire: 0,
    })
    const usages = await listMediaUsagesFor(getDb(), "builder-page", page.id)
    expect(usages.map((u) => u.field).sort()).toEqual([
      "blocks.0.data.image",
      "seo.ogImage",
    ])
    // A later draft save keeps the share image's usage.
    const saved = await saveDraft(page.id, {
      version: page.version,
      draft: page.draft,
    })
    expect(saved.status).toBe(200)
    expect(
      (await listMediaUsagesFor(getDb(), "builder-page", page.id)).map(
        (u) => u.field
      )
    ).toContain("seo.ogImage")

    const overview = await adminRequest("/seo/overview", { cookie: viewer })
    const { entries } = (await overview.json()) as { entries: SeoEntry[] }
    expect(entries.filter((e) => e.kind === "builder")).toHaveLength(1)

    const editorRes = await adminRequest(`/seo/entries/builder/${page.id}`, {
      cookie: viewer,
      method: "PUT",
      json: { seo: {} },
    })
    expect(editorRes.status).toBe(403)
  })

  it("newsletterBlockPublished: only a visible, published newsletter block counts", async () => {
    expect(await newsletterBlockPublished()).toBe(false)
    const { page } = await publishedPage()
    expect(await newsletterBlockPublished()).toBe(false)
    const block = {
      id: "newsletter-1",
      type: "newsletter",
      anchor: "newsletter",
      hidden: true,
      data: { useShared: true },
    }
    const hidden = await saveDraft(page.id, {
      version: page.version,
      draft: { blocks: [...page.published!.blocks, block] },
    })
    const dto = (await hidden.json()) as BuilderPageDto
    // Draft only: not counted.
    expect(await newsletterBlockPublished()).toBe(false)
    const pub = (await (
      await publish(page.id, dto.version)
    ).json()) as BuilderPageDto
    expect(await newsletterBlockPublished()).toBe(false) // hidden
    const shown = await saveDraft(page.id, {
      version: pub.version,
      draft: {
        blocks: [...page.published!.blocks, { ...block, hidden: false }],
      },
    })
    const shownDto = (await shown.json()) as BuilderPageDto
    expect((await publish(page.id, shownDto.version)).status).toBe(200)
    expect(await newsletterBlockPublished()).toBe(true)
    const rows = await getDb()
      .select({ id: builderPages.id })
      .from(builderPages)
      .where(and(eq(builderPages.id, page.id)))
    expect(rows).toHaveLength(1)
  })
})
