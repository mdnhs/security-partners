import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Hono runs outside Next here: record invalidations instead of revalidating.
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type {
  ArticleDto,
  ArticleListItem,
  ArticleOptions,
} from "@/lib/schemas/api/articles"
import type { RevisionSummary } from "@/lib/schemas/api/content"
import type { Paginated } from "@/lib/schemas/api/list"
import type { RichTextDoc } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import {
  articleCategories,
  articles,
  auditLog,
  media,
  revisions,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type Who = { cookie: string; user: { id: string } }
type ErrorBody = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    current?: ArticleDto
  }
}

let editor: Who
let author: Who
let otherAuthor: Who
let viewer: Who
let intake: Who
let categoryId: string
let newsCategoryId: string
let coverId: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = await signedInUser(["editor"])
  author = await signedInUser(["author"])
  otherAuthor = await signedInUser(["author"])
  viewer = await signedInUser(["viewer"])
  intake = await signedInUser(["intake"])
  const db = getDb()
  const category = async (slug: string) => {
    const [row] = await db
      .select()
      .from(articleCategories)
      .where(eq(articleCategories.slug, slug))
    return row.id
  }
  categoryId = await category("mobile-patrols")
  newsCategoryId = await category("company-news")
  const [hero] = await db
    .select()
    .from(media)
    .where(eq(media.key, "/images/hero.jpg"))
  coverId = hero.id
  revalidateTag.mockClear()
})

const json = async <T>(res: Response) => (await res.json()) as T
const text = (value: string) => ({ type: "text" as const, text: value })
const paragraph = (value: string) => ({
  type: "paragraph" as const,
  content: [text(value)],
})
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(" ")
/** 449 words + a one-word heading = 450 words → 3 min at 200 wpm. */
const longBody: RichTextDoc = {
  type: "doc",
  content: [
    paragraph(words(449)),
    { type: "heading", attrs: { level: 2 }, content: [text("Summary")] },
  ],
}

const draftOf = (title: string, body: RichTextDoc | null = null) => ({
  title,
  excerpt: "What a night patrol covers.",
  cover: { mediaId: coverId },
  lead: null,
  tags: [],
  body,
})

const call = (who: Who, path: string, method = "GET", body?: unknown) =>
  adminRequest(path, { cookie: who.cookie, method, json: body })

async function create(
  who: Who,
  slug = "night-patrols",
  body: RichTextDoc | null = null
) {
  const res = await call(who, "/articles", "POST", {
    slug,
    categoryId,
    draft: draftOf("Night Patrols", body),
  })
  expect(res.status).toBe(201)
  return json<ArticleDto>(res)
}

const saveDraft = (
  who: Who,
  article: { id: string; draft: unknown },
  version: number,
  title = "Night Patrols, updated"
) =>
  call(who, `/articles/${article.id}/draft`, "PUT", {
    draft: { ...(article.draft as object), title },
    version,
  })

const step = (
  who: Who,
  id: string,
  action: "submit" | "publish" | "unschedule" | "unpublish",
  version: number
) => call(who, `/articles/${id}/${action}`, "POST", { version })

async function row(slug: string) {
  const [found] = await getDb()
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
  return found
}

async function auditActions(id: string) {
  const rows = await getDb()
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(eq(auditLog.entityId, id))
  return rows.map((r) => r.action).sort()
}

async function revisionVersions(id: string) {
  const rows = await getDb()
    .select({ version: revisions.version })
    .from(revisions)
    .where(and(eq(revisions.entityType, "article"), eq(revisions.entityId, id)))
  return rows.map((r) => r.version).sort((a, b) => a - b)
}

describe("articles API (master 5.1)", () => {
  it("an author creates a draft under their own byline", async () => {
    const article = await create(author)
    expect(article).toMatchObject({
      slug: "night-patrols",
      title: "Night Patrols",
      status: "draft",
      version: 1,
      live: false,
      published: null,
      dirty: true,
      author: { id: author.user.id },
      category: { id: categoryId, slug: "mobile-patrols" },
      permissions: {
        update: true,
        delete: true,
        submit: true,
        publish: false,
        changeAuthor: false,
      },
    })
    expect(await listMediaUsagesFor(getDb(), "article", article.id)).toEqual([
      { mediaId: coverId, field: "cover" },
    ])
    expect(revalidateTag).not.toHaveBeenCalled()

    const asSomeoneElse = await call(author, "/articles", "POST", {
      slug: "under-another-name",
      categoryId,
      authorId: editor.user.id,
      draft: draftOf("Not mine"),
    })
    expect(asSomeoneElse.status).toBe(403)

    const forAuthor = await call(editor, "/articles", "POST", {
      slug: "for-the-author",
      categoryId,
      authorId: author.user.id,
      draft: draftOf("Written for the author"),
    })
    expect(forAuthor.status).toBe(201)
    expect((await json<ArticleDto>(forAuthor)).author?.id).toBe(author.user.id)
  })

  it("validates the address, category and fields; stores an empty body as none", async () => {
    expect(
      (
        await call(author, "/articles", "POST", {
          slug: "Bad Slug",
          categoryId,
          draft: draftOf("x"),
        })
      ).status
    ).toBe(422)
    const clash = await call(author, "/articles", "POST", {
      slug: "key-holding-explained",
      categoryId,
      draft: draftOf("x"),
    })
    expect(clash.status).toBe(409)
    expect((await json<ErrorBody>(clash)).error.fieldErrors?.slug).toBeTruthy()
    const noCategory = await call(author, "/articles", "POST", {
      slug: "no-category",
      categoryId: "00000000-0000-7000-8000-000000000999",
      draft: draftOf("x"),
    })
    expect(noCategory.status).toBe(422)
    expect(
      Object.keys((await json<ErrorBody>(noCategory)).error.fieldErrors ?? {})
    ).toEqual(["categoryId"])
    const noTitle = await call(author, "/articles", "POST", {
      slug: "no-title",
      categoryId,
      draft: draftOf(""),
    })
    expect((await json<ErrorBody>(noTitle)).error.fieldErrors).toEqual({
      title: ["Required"],
    })

    const emptyBody = await create(author, "empty-body", {
      type: "doc",
      content: [{ type: "paragraph" }],
    })
    expect(emptyBody.draft.body).toBeNull()
  })

  it("author: saves own draft, submits it for review, keeps editing in review", async () => {
    const article = await create(author)
    const saved = await saveDraft(author, article, 1)
    expect(saved.status).toBe(200)
    expect((await json<ArticleDto>(saved)).version).toBe(2)

    const submitted = await step(author, article.id, "submit", 2)
    expect(submitted.status).toBe(200)
    expect(await json<ArticleDto>(submitted)).toMatchObject({
      status: "in_review",
      version: 3,
      live: false,
    })
    expect((await step(author, article.id, "submit", 3)).status).toBe(409)

    const edited = await saveDraft(author, article, 3, "Reviewed title")
    expect(await json<ArticleDto>(edited)).toMatchObject({
      status: "in_review",
      version: 4,
      title: "Reviewed title",
    })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("Review Focus 5: an author cannot publish via the API, nor edit others' or published articles", async () => {
    const mine = await create(author)
    for (const action of ["publish", "unpublish", "unschedule"] as const) {
      const res = await step(author, mine.id, action, 1)
      expect(res.status).toBe(403)
      expect((await json<ErrorBody>(res)).error.code).toBe("FORBIDDEN")
    }
    expect(
      (
        await call(author, `/articles/${mine.id}/schedule`, "POST", {
          version: 1,
          scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
      ).status
    ).toBe(403)

    // Someone else's draft: readable, not writable.
    expect((await call(otherAuthor, `/articles/${mine.id}`)).status).toBe(200)
    expect((await saveDraft(otherAuthor, mine, 1)).status).toBe(403)
    expect((await step(otherAuthor, mine.id, "submit", 1)).status).toBe(403)
    expect(
      (await call(otherAuthor, `/articles/${mine.id}?version=1`, "DELETE"))
        .status
    ).toBe(403)

    // A seeded, published article under another byline.
    const live = await row("mobile-patrols-protect-your-business-after-hours")
    expect(
      (
        await saveDraft(
          author,
          { id: live.id, draft: live.draft },
          live.version
        )
      ).status
    ).toBe(403)

    // Their own article once an editor published it.
    expect((await step(editor, mine.id, "publish", 1)).status).toBe(200)
    expect((await saveDraft(author, mine, 2)).status).toBe(403)
    expect(
      (await call(author, `/articles/${mine.id}?version=2`, "DELETE")).status
    ).toBe(403)
    const view = await json<ArticleDto>(
      await call(author, `/articles/${mine.id}`)
    )
    expect(view.permissions).toEqual({
      update: false,
      delete: false,
      submit: false,
      publish: false,
      changeAuthor: false,
    })
    expect((await row("night-patrols")).version).toBe(2)
  })

  it("an editor publishes: live copy, read time, revision, cache tags; republishing keeps the date", async () => {
    const article = await create(author, "night-patrols", longBody)
    const res = await step(editor, article.id, "publish", 1)
    expect(res.status).toBe(200)
    const published = await json<ArticleDto>(res)
    expect(published).toMatchObject({
      status: "published",
      version: 2,
      live: true,
      dirty: false,
      readTimeMinutes: 3,
      scheduledAt: null,
    })
    expect(published.publishedAt).not.toBeNull()
    expect(published.published).toEqual(published.draft)
    expect(revalidateTag.mock.calls).toEqual([
      ["articles", { expire: 0 }],
      ["article:night-patrols", { expire: 0 }],
    ])

    const edited = await json<ArticleDto>(
      await saveDraft(editor, published, 2, "Night Patrols (2026 edition)")
    )
    expect(edited).toMatchObject({ status: "published", dirty: true })
    const again = await json<ArticleDto>(
      await step(editor, article.id, "publish", 3)
    )
    expect(again.publishedAt).toBe(published.publishedAt)
    expect(again.published?.title).toBe("Night Patrols (2026 edition)")
    expect(await revisionVersions(article.id)).toEqual([1, 2, 4])
  })

  it("rejects stale versions with 409 and the current state (Review Focus 2)", async () => {
    const article = await create(author)
    expect((await saveDraft(author, article, 1, "First")).status).toBe(200)
    const stale = await saveDraft(author, article, 1, "Second")
    expect(stale.status).toBe(409)
    const body = await json<ErrorBody>(stale)
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.current).toMatchObject({ version: 2, title: "First" })
    expect((await step(editor, article.id, "publish", 1)).status).toBe(409)
    expect((await row("night-patrols")).published).toBeNull()
  })

  it("schedules for a future time only (422 in the past) and unschedules", async () => {
    const article = await create(author)
    const path = `/articles/${article.id}/schedule`
    const past = await call(editor, path, "POST", {
      version: 1,
      scheduledAt: "2020-01-01T09:00:00Z",
    })
    expect(past.status).toBe(422)
    expect((await json<ErrorBody>(past)).error.fieldErrors).toEqual({
      scheduledAt: ["Choose a time in the future"],
    })
    expect(
      (
        await call(editor, path, "POST", {
          version: 1,
          scheduledAt: "tomorrow",
        })
      ).status
    ).toBe(422)

    const at = new Date(Date.now() + 86_400_000).toISOString()
    const scheduled = await json<ArticleDto>(
      await call(editor, path, "POST", { version: 1, scheduledAt: at })
    )
    expect(scheduled).toMatchObject({
      status: "scheduled",
      scheduledAt: at,
      live: false,
      version: 2,
    })
    expect(revalidateTag).not.toHaveBeenCalled()
    // Approved content is locked for its author until it is unscheduled.
    expect((await saveDraft(author, article, 2)).status).toBe(403)

    const cancelled = await json<ArticleDto>(
      await step(editor, article.id, "unschedule", 2)
    )
    expect(cancelled).toMatchObject({
      status: "draft",
      scheduledAt: null,
      version: 3,
    })
    expect((await step(editor, article.id, "unschedule", 3)).status).toBe(409)
  })

  it("unpublishes (off the site, back to draft) but protects the blog's featured article", async () => {
    const live = await row("mobile-patrols-protect-your-business-after-hours")
    const res = await step(editor, live.id, "unpublish", live.version)
    expect(res.status).toBe(200)
    expect(await json<ArticleDto>(res)).toMatchObject({
      status: "draft",
      live: false,
      publishedAt: null,
    })
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual([
      "articles",
      "article:mobile-patrols-protect-your-business-after-hours",
    ])

    const featured = await row("18-years-of-watching-over-ireland")
    const blocked = await step(
      editor,
      featured.id,
      "unpublish",
      featured.version
    )
    expect(blocked.status).toBe(409)
    expect((await json<ErrorBody>(blocked)).error.message).toContain("featured")
  })

  it("changes address, category and byline (live at once) with the usual guards", async () => {
    const article = await create(author)
    await step(editor, article.id, "publish", 1)
    revalidateTag.mockClear()
    const moved = await call(editor, `/articles/${article.id}/meta`, "PATCH", {
      version: 2,
      slug: "night-patrol-guide",
      categoryId: newsCategoryId,
      authorId: otherAuthor.user.id,
    })
    expect(moved.status).toBe(200)
    expect(await json<ArticleDto>(moved)).toMatchObject({
      slug: "night-patrol-guide",
      version: 3,
      category: { id: newsCategoryId },
      author: { id: otherAuthor.user.id },
    })
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual([
      "articles",
      "article:night-patrols",
      "article:night-patrol-guide",
    ])

    const clash = await call(editor, `/articles/${article.id}/meta`, "PATCH", {
      version: 3,
      slug: "key-holding-explained",
    })
    expect(clash.status).toBe(409)
    expect((await json<ErrorBody>(clash)).error.fieldErrors?.slug).toBeTruthy()

    const featured = await row("18-years-of-watching-over-ireland")
    expect(
      (
        await call(editor, `/articles/${featured.id}/meta`, "PATCH", {
          version: featured.version,
          slug: "eighteen-years",
        })
      ).status
    ).toBe(409)

    const draft = await create(author, "author-draft")
    expect(
      (
        await call(author, `/articles/${draft.id}/meta`, "PATCH", {
          version: 1,
          categoryId: newsCategoryId,
        })
      ).status
    ).toBe(200)
    expect(
      (
        await call(author, `/articles/${draft.id}/meta`, "PATCH", {
          version: 2,
          authorId: editor.user.id,
        })
      ).status
    ).toBe(403)
    expect(
      (
        await call(author, `/articles/${draft.id}/meta`, "PATCH", {
          version: 2,
        })
      ).status
    ).toBe(422)
  })

  it("deletes own drafts (author) or any article (editor), checking the version", async () => {
    const article = await create(author)
    expect(
      (await call(author, `/articles/${article.id}?version=9`, "DELETE")).status
    ).toBe(409)
    expect(
      (await call(author, `/articles/${article.id}?version=1`, "DELETE")).status
    ).toBe(200)
    expect(await listMediaUsagesFor(getDb(), "article", article.id)).toEqual([])
    expect((await call(author, `/articles/${article.id}`)).status).toBe(404)
    expect(revalidateTag).not.toHaveBeenCalled()

    const live = await row("key-holding-explained")
    expect(
      (
        await call(
          editor,
          `/articles/${live.id}?version=${live.version}`,
          "DELETE"
        )
      ).status
    ).toBe(200)
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual([
      "articles",
      "article:key-holding-explained",
    ])
  })

  it("lists with status, category, author and text filters; intake cannot read", async () => {
    await create(author, "first-draft")
    const second = await create(author, "second-draft")
    await step(author, second.id, "submit", 1)

    const mine = await json<Paginated<ArticleListItem>>(
      await call(author, "/articles?author=me")
    )
    expect(mine.total).toBe(2)
    expect(mine.items.map((a) => a.slug).sort()).toEqual([
      "first-draft",
      "second-draft",
    ])
    expect(mine.items[0]).not.toHaveProperty("draft")

    const queue = await json<Paginated<ArticleListItem>>(
      await call(editor, "/articles?status=in_review")
    )
    expect(queue.items.map((a) => a.slug)).toEqual(["second-draft"])

    const patrols = await json<Paginated<ArticleListItem>>(
      await call(viewer, `/articles?category=${categoryId}&pageSize=50`)
    )
    expect(patrols.items.map((a) => a.slug)).toContain(
      "mobile-patrols-protect-your-business-after-hours"
    )
    expect(
      patrols.items.every(
        (a) => !a.permissions.update && !a.permissions.publish
      )
    ).toBe(true)

    const search = await json<Paginated<ArticleListItem>>(
      await call(editor, "/articles?q=open%20up")
    )
    expect(search.items.map((a) => a.slug)).toEqual([
      "open-up-lock-up-keeps-staff-safe",
    ])

    expect((await call(intake, "/articles")).status).toBe(403)
    expect((await call(editor, "/articles?status=nope")).status).toBe(422)
  })

  it("options: categories for every reader, possible bylines for editors only", async () => {
    const forAuthor = await json<ArticleOptions>(
      await call(author, "/articles/options")
    )
    expect(forAuthor.categories.map((c) => c.slug)).toContain("mobile-patrols")
    expect(forAuthor.authors).toEqual([])
    // The blog's featured article (cannot be unpublished, deleted or moved):
    // the editor says why before anyone tries.
    expect(forAuthor.featured).toEqual(["18-years-of-watching-over-ireland"])

    const forEditor = await json<ArticleOptions>(
      await call(editor, "/articles/options")
    )
    const ids = forEditor.authors.map((a) => a.id)
    expect(ids).toEqual(
      expect.arrayContaining([editor.user.id, author.user.id])
    )
    // The seeded byline (no-login account) stays selectable.
    expect(forEditor.authors.map((a) => a.name)).toContain("Michael McDonald")
    expect(ids).not.toContain(viewer.user.id)
  })

  it("audits and snapshots every transition; history restores into the draft", async () => {
    const article = await create(author) // v1 (revision)
    await saveDraft(author, article, 1, "Second title") // v2 (no revision)
    await step(author, article.id, "submit", 2) // v3
    await step(editor, article.id, "publish", 3) // v4
    await step(editor, article.id, "unpublish", 4) // v5
    expect(await auditActions(article.id)).toEqual(
      [
        "article.created",
        "article.draft_saved",
        "article.submitted",
        "article.published",
        "article.unpublished",
      ].sort()
    )
    expect(await revisionVersions(article.id)).toEqual([1, 3, 4, 5])

    const history = await json<{ items: RevisionSummary[] }>(
      await call(viewer, `/revisions/article/${article.id}`)
    )
    expect(history.items.map((r) => r.version)).toEqual([5, 4, 3, 1])
    expect(
      (await call(intake, `/revisions/article/${article.id}`)).status
    ).toBe(403)

    const first = history.items.find((r) => r.version === 1)!
    const restored = await call(
      author,
      `/articles/${article.id}/restore`,
      "POST",
      {
        revisionId: first.id,
        version: 5,
      }
    )
    expect(restored.status).toBe(200)
    expect(await json<ArticleDto>(restored)).toMatchObject({
      version: 6,
      title: "Night Patrols",
      status: "draft",
    })
  })
})
