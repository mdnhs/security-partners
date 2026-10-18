import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"
import { getDb } from "@/server/db/client"
import { auditLog, media, mediaUsages } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { backfillMediaUsages } from "@/server/lib/media-usages"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let marketer: string
let viewer: string
let author: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  author = (await signedInUser(["author"])).cookie
  revalidateTag.mockClear()
})

const put = (cookie: string, kind: string, id: string, seo: unknown) =>
  adminRequest(`/seo/entries/${kind}/${id}`, {
    cookie,
    method: "PUT",
    json: { seo },
  })

async function service(slug: string) {
  const res = await adminRequest(`/services?q=${slug}`, { cookie: editor })
  const { items } = (await res.json()) as {
    items: { id: string; slug: string; version: number }[]
  }
  return items.find((i) => i.slug === slug)!
}

describe("SEO API (master 8.1)", () => {
  it("overview: every page, service and article with effective title and checks", async () => {
    const res = await adminRequest("/seo/overview", { cookie: viewer })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as SeoOverviewDto
    const fx = fixtureSiteSources()
    expect(dto.entries).toHaveLength(
      8 + fx.services.length + fx.articles.length
    )
    expect(
      dto.entries.find((e) => e.kind === "page" && e.id === "home")
    ).toMatchObject({
      name: "Home",
      path: "/",
      published: true,
      image: "generated",
      title: "Security Partners Ltd. | Watching Over You",
    })
    const live = dto.entries.filter((e) => e.published)
    const issues = live.reduce((n, e) => n + e.issues.length, 0)
    expect(dto.checks).toEqual({
      passed: live.length * 4 - issues,
      total: live.length * 4,
    })
  })

  it("marketer saves a service's SEO: live at once, version untouched, audited", async () => {
    const s = await service("alarm-responses")
    const res = await put(marketer, "service", s.id, {
      title: "",
      description:
        "Fast alarm response across Laois, Offaly and Kildare, day and night.",
      noindex: false,
    })
    expect(res.status).toBe(200)
    const entry = (await res.json()) as SeoEntry
    expect(entry.seo).toEqual({
      description:
        "Fast alarm response across Laois, Offaly and Kildare, day and night.",
      noindex: false,
    })
    expect(entry.issues.map((i) => i.check)).not.toContain("own-description")
    expect((await service("alarm-responses")).version).toBe(s.version)
    expect(revalidateTag).toHaveBeenCalledWith("service:alarm-responses", {
      expire: 0,
    })
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "service.seo_updated"),
          eq(auditLog.entityId, s.id)
        )
      )
    expect(audit.diff).toEqual({ fields: ["description", "noindex"] })
  })

  it("validation: canonical must be http(s); a missing image → 422 on ogImage", async () => {
    const bad = await put(editor, "page", "about", {
      canonical: "javascript:alert(1)",
    })
    expect(bad.status).toBe(422)
    for (const canonical of [
      "https://x.ie/a\nb",
      "https://x.ie/a b",
      `https://x.ie/${"a".repeat(2000)}`,
    ])
      expect(
        (await put(editor, "page", "about", { canonical })).status,
        canonical
      ).toBe(422)
    const missing = await put(editor, "page", "about", {
      ogImage: { mediaId: "01900000-0000-7000-8000-000000000000" },
    })
    expect(missing.status).toBe(422)
    const body = (await missing.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toEqual(["ogImage"])
  })

  it("a share image keeps its media usage through later draft saves", async () => {
    const [image] = await getDb().select().from(media).limit(1)
    expect(
      (await put(editor, "page", "about", { ogImage: { mediaId: image.id } }))
        .status
    ).toBe(200)
    const usage = () =>
      getDb()
        .select()
        .from(mediaUsages)
        .where(
          and(
            eq(mediaUsages.entityType, "page"),
            eq(mediaUsages.entityId, "about"),
            eq(mediaUsages.field, "seo.ogImage")
          )
        )
    expect(await usage()).toHaveLength(1)
    const page = (await (
      await adminRequest("/pages/about", { cookie: editor })
    ).json()) as { draft: unknown; version: number }
    const saved = await adminRequest("/pages/about/draft", {
      cookie: editor,
      method: "PUT",
      json: { draft: page.draft, version: page.version },
    })
    expect(saved.status).toBe(200)
    expect(await usage()).toHaveLength(1)
    // The media-usages backfill recomputes the same rows (seo included).
    await backfillMediaUsages(getDb())
    expect(await usage()).toHaveLength(1)
  })

  it("permissions and unknown records", async () => {
    expect(
      (await adminRequest("/seo/overview", { cookie: author })).status
    ).toBe(403)
    expect((await put(viewer, "page", "about", {})).status).toBe(403)
    expect((await put(editor, "page", "nope", {})).status).toBe(404)
    expect((await put(editor, "service", "not-a-uuid", {})).status).toBe(404)
    expect(
      (await put(editor, "service", "01900000-0000-7000-8000-000000000001", {}))
        .status
    ).toBe(404)
  })
})
