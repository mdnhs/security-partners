import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { SeoHealthDto } from "@/lib/schemas/api/seo"
import { getDb } from "@/server/db/client"
import { articles, media } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
})

const putSeo = async (kind: string, id: string, seo: unknown) => {
  const res = await adminRequest(`/seo/entries/${kind}/${id}`, {
    cookie: editor,
    method: "PUT",
    json: { seo },
  })
  expect(res.status, await res.clone().text()).toBe(200)
}

async function health(cookie = editor) {
  const res = await adminRequest("/seo/health", { cookie })
  expect(res.status).toBe(200)
  return (await res.json()) as SeoHealthDto
}

/** A published service and article of the seed. */
async function liveRecords() {
  const dto = await health()
  const service = dto.entities.find((e) => e.kind === "service" && e.published)!
  const article = dto.entities.find((e) => e.kind === "article" && e.published)!
  return { service, article }
}

const result = (dto: SeoHealthDto, kind: string, id: string, check: string) =>
  dto.entities
    .find((e) => e.kind === kind && e.id === id)!
    .results.find((r) => r.id === check)!

describe("GET /seo/health (D1.2)", () => {
  it("score, passed and total over the published records' eight checks", async () => {
    const dto = await health()
    const live = dto.entities.filter((e) => e.published)
    expect(live.length).toBeGreaterThan(0)
    for (const e of dto.entities) expect(e.results).toHaveLength(8)
    expect(dto.total).toBe(live.length * 8)
    expect(dto.passed).toBe(
      live.flatMap((e) => e.results).filter((r) => r.ok).length
    )
    expect(dto.score).toBe(Math.round((dto.passed / dto.total) * 100))
    // Fixed templates always render an H1.
    expect(
      dto.entities.every((e) => e.results.find((r) => r.id === "h1")!.ok)
    ).toBe(true)
    // Issues are the published records' failures (plus media).
    expect(dto.issues.filter((i) => i.kind !== "media").length).toBe(
      live.flatMap((e) => e.results).filter((r) => !r.ok).length
    )
  })

  it("duplicate titles (case/space-insensitive) fail title-unique on both records", async () => {
    const { service } = await liveRecords()
    await putSeo("page", "about", {
      title: "About us at Security Partners Ltd.",
    })
    await putSeo("service", service.id, {
      title: "  about US at Security   Partners Ltd. ",
    })
    const dto = await health()
    expect(result(dto, "page", "about", "title-unique")).toEqual({
      id: "title-unique",
      ok: false,
      message: "Another page uses the same title",
    })
    expect(result(dto, "service", service.id, "title-unique").ok).toBe(false)
    expect(result(dto, "page", "contact", "title-unique").ok).toBe(true)
    expect(
      dto.issues.filter((i) => i.check === "title-unique").map((i) => i.id)
    ).toEqual(expect.arrayContaining(["about", service.id]))
  })

  it("one shared image without alt: alt card missing=1, both records have alt-text issues, media issue listed once", async () => {
    const before = await health()
    const { service } = await liveRecords()
    const [image] = await getDb()
      .insert(media)
      .values({
        key: "/images/share-no-alt.png",
        driver: "static",
        mime: "image/png",
        size: 10,
        width: 1200,
        height: 630,
        originalName: "share-no-alt.png",
      })
      .returning()
    await putSeo("page", "about", { ogImage: { mediaId: image.id } })
    await putSeo("service", service.id, { ogImage: { mediaId: image.id } })
    const dto = await health()

    expect(dto.alt.missing).toBe(before.alt.missing + 1)
    expect(dto.alt.images).toBe(before.alt.images + 1)
    for (const [kind, id] of [
      ["page", "about"],
      ["service", service.id],
    ]) {
      const r = result(dto, kind, id, "alt-text")
      expect(r.ok).toBe(false)
      expect(r.message).toMatch(/^\d+ image\(s\) missing alt text$/)
      expect(
        dto.issues.some(
          (i) => i.kind === kind && i.id === id && i.check === "alt-text"
        )
      ).toBe(true)
    }
    const mediaIssues = dto.issues.filter(
      (i) => i.kind === "media" && i.id === image.id
    )
    expect(mediaIssues).toEqual([
      {
        kind: "media",
        id: image.id,
        title: "share-no-alt.png",
        path: null,
        check: "alt-text",
        message: "1 image(s) missing alt text",
        fixHref: `/admin/media?missingAlt=true&open=${image.id}`,
      },
    ])
    // The 1200×630 image passes the share-image check.
    expect(result(dto, "page", "about", "og-image").ok).toBe(true)

    // Marked decorative: no longer missing anywhere.
    const res = await adminRequest(`/media/${image.id}`, {
      cookie: editor,
      method: "PATCH",
      json: { isDecorative: true },
    })
    expect(res.status).toBe(200)
    const after = await health()
    expect(after.alt.missing).toBe(before.alt.missing)
    expect(after.issues.some((i) => i.id === image.id)).toBe(false)
  })

  it("a share image that is too small fails og-image", async () => {
    const [image] = await getDb()
      .insert(media)
      .values({
        key: "/images/small-share.png",
        driver: "static",
        mime: "image/png",
        size: 10,
        width: 1200,
        height: 600,
        alt: "Patrol car",
      })
      .returning()
    await putSeo("page", "about", { ogImage: { mediaId: image.id } })
    expect(result(await health(), "page", "about", "og-image")).toEqual({
      id: "og-image",
      ok: false,
      message: "Share image should be at least 1200×630 (1.91:1)",
    })
  })

  it("fixHref per kind", async () => {
    const { service, article } = await liveRecords()
    await putSeo("page", "about", { noindex: true })
    await putSeo("service", service.id, { noindex: true })
    await putSeo("article", article.id, { noindex: true })
    const dto = await health()
    const fix = (kind: string, id: string) =>
      dto.issues.find(
        (i) => i.kind === kind && i.id === id && i.check === "indexable"
      )
    expect(fix("page", "about")).toMatchObject({
      title: "About",
      path: "/about",
      message: "Hidden from search engines",
      fixHref: "/admin/pages/about?tab=seo",
    })
    expect(fix("service", service.id)?.fixHref).toBe(
      `/admin/services/${service.id}?tab=seo`
    )
    expect(fix("article", article.id)?.fixHref).toBe(
      `/admin/insights/${article.id}?tab=seo`
    )
  })

  it("internal-link reads the live article body from the database", async () => {
    const { article } = await liveRecords()
    const setBody = (body: unknown) =>
      getDb()
        .update(articles)
        .set({
          published: sql`jsonb_set(${articles.published}, '{body}', ${JSON.stringify(body)}::jsonb)`,
        })
        .where(eq(articles.id, article.id))
    const paragraph = (href?: string) => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Read more",
              ...(href ? { marks: [{ type: "link", attrs: { href } }] } : {}),
            },
          ],
        },
      ],
    })

    await setBody(paragraph())
    expect(
      result(await health(), "article", article.id, "internal-link").ok
    ).toBe(false)

    await setBody(paragraph("/contact"))
    expect(
      result(await health(), "article", article.id, "internal-link").ok
    ).toBe(true)

    // A body that does not parse fails (counted as 0), never passes silently.
    await setBody({ type: "doc", content: [{ type: "nope" }] })
    expect(
      result(await health(), "article", article.id, "internal-link").ok
    ).toBe(false)
  })

  it("seo:read only; the overview stays served", async () => {
    const author = (await signedInUser(["author"])).cookie
    expect((await adminRequest("/seo/health", { cookie: author })).status).toBe(
      403
    )
    const viewer = (await signedInUser(["viewer"])).cookie
    await health(viewer)
    expect(
      (await adminRequest("/seo/overview", { cookie: viewer })).status
    ).toBe(200)
  })
})
