import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Outside Next: no cache, record draft-mode switches.
const { enable } = vi.hoisted(() => ({ enable: vi.fn() }))
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  draftMode: async () => ({ isEnabled: false, enable, disable: vi.fn() }),
}))

import {
  type BuilderDocument,
  DraftDocument,
  validateDocument,
} from "@/blocks/document"
import {
  BLOCK_TYPES,
  type BlockType,
  RESERVED_ANCHORS,
} from "@/blocks/registry"
import type { BuilderPageDto } from "@/lib/schemas/api/builder-pages"
import { buildSitemap } from "@/lib/seo/sitemap"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { builderPages } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { resolvePublicPath } from "@/server/modules/redirects/resolve"
import { listSeoRows } from "@/server/modules/seo/repo"
import {
  getOgSubject,
  isOgSubjectId,
  listSitemapEntries,
} from "@/server/modules/seo/queries"

import {
  seedVisualBuilderPage,
  VISUAL_BUILDER_SLUG,
} from "../../visual/builder-fixture"
import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const live = { draft: false }
const preview = { draft: true }

const DOC: BuilderDocument = {
  blocks: [
    {
      id: "block-about",
      type: "about",
      anchor: "about",
      hidden: false,
      data: { useShared: true },
    },
  ],
}

async function insertPage(
  slug: string,
  opts: { published?: boolean; noindex?: boolean; title?: string } = {}
) {
  const [row] = await getDb()
    .insert(builderPages)
    .values({
      slug,
      title: opts.title ?? `Page ${slug}`,
      draft: DOC,
      published: opts.published === false ? null : DOC,
      status: opts.published === false ? "draft" : "published",
      publishedAt: opts.published === false ? null : new Date(),
      seo: opts.noindex ? { noindex: true } : {},
    })
    .returning()
  return row
}

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  enable.mockClear()
})

describe("resolvePublicPath: /p/<slug> (D5.3)", () => {
  it("a missing page is a real 404, a published one passes", async () => {
    await insertPage("published")
    expect(await resolvePublicPath("/p/missing", live)).toEqual({
      kind: "missing",
    })
    expect(await resolvePublicPath("/p/published", live)).toEqual({
      kind: "pass",
    })
  })

  it("draft-only pages 404 unless the draft cookie is present", async () => {
    await insertPage("draft-only", { published: false })
    expect(await resolvePublicPath("/p/draft-only", live)).toEqual({
      kind: "missing",
    })
    expect(await resolvePublicPath("/p/draft-only", preview)).toEqual({
      kind: "pass",
    })
  })

  it("malformed and reserved addresses are missing", async () => {
    for (const path of [
      "/p/Upper",
      "/p/a--b",
      `/p/${"x".repeat(61)}`,
      "/p/é",
      "/p/admin",
      "/p/api",
    ])
      expect(await resolvePublicPath(path, live), path).toEqual({
        kind: "missing",
      })
  })

  it("a deleted page 404s; a stored redirect for it still applies", async () => {
    const row = await insertPage("gone")
    await getDb().delete(builderPages).where(eq(builderPages.id, row.id))
    expect(await resolvePublicPath("/p/gone", live)).toEqual({
      kind: "missing",
    })

    const { cookie } = await signedInUser(["editor"])
    const moved = await insertPage("moved-home")
    const res = await adminRequest(
      `/builder-pages/${moved.id}?redirectHome=true`,
      { cookie, method: "DELETE" }
    )
    expect(res.status).toBe(200)
    expect(await resolvePublicPath("/p/moved-home", live)).toMatchObject({
      kind: "redirect",
      to: "/",
      code: 301,
    })
  })

  it("a page republished at a redirected address serves again (live beats redirect)", async () => {
    const { cookie } = await signedInUser(["editor"])
    const first = await insertPage("comeback")
    const res = await adminRequest(
      `/builder-pages/${first.id}?redirectHome=true`,
      { cookie, method: "DELETE" }
    )
    expect(res.status).toBe(200)
    expect(await resolvePublicPath("/p/comeback", live)).toMatchObject({
      kind: "redirect",
      to: "/",
    })
    // The /p/comeback → / row stays; a new live page at the slug wins.
    await insertPage("comeback")
    expect(await resolvePublicPath("/p/comeback", live)).toEqual({
      kind: "pass",
    })
  })

  it("/p/old after a slug change is a 301 to /p/new", async () => {
    const { cookie } = await signedInUser(["editor"])
    const row = await insertPage("old")
    const res = await adminRequest(`/builder-pages/${row.id}/meta`, {
      cookie,
      method: "PATCH",
      json: { version: row.version, slug: "new" },
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as BuilderPageDto).slug).toBe("new")
    expect(await resolvePublicPath("/p/old", live)).toMatchObject({
      kind: "redirect",
      to: "/p/new",
      code: 301,
    })
    expect(await resolvePublicPath("/p/new", live)).toEqual({ kind: "pass" })
  })
})

describe("SEO overview fallback description (D5.3 review minor 2)", () => {
  it("is the hero's description only when a page hero comes first", async () => {
    const first = (type: BlockType, description: string) => ({
      blocks: [
        {
          id: `block-${type}`,
          type,
          anchor: "first",
          hidden: false,
          data: { description },
        },
      ],
    })
    await getDb()
      .insert(builderPages)
      .values([
        {
          slug: "with-hero",
          title: "With hero",
          draft: first("hero.page", "Hero intro"),
        },
        {
          slug: "cards-first",
          title: "Cards first",
          draft: first("iconCards", "Cards intro"),
        },
      ])
    const rows = await listSeoRows(getDb())
    const bySlug = (slug: string) =>
      rows.find((r) => r.kind === "builder" && r.slug === slug)
    expect(bySlug("with-hero")?.description).toBe("Hero intro")
    expect(bySlug("cards-first")?.description).toBeNull()
  })
})

describe("sitemap and share cards: builder pages (D5.3)", () => {
  it("lists published, indexable builder pages only", async () => {
    await insertPage("published")
    await insertPage("hidden", { noindex: true })
    await insertPage("draft-only", { published: false })
    const entries = await listSitemapEntries()
    const published = entries.find((e) => e.path === "/p/published")
    expect(published).toMatchObject({ noindex: false })
    expect(published?.lastModified).toBeInstanceOf(Date)
    // noindex rows are reported; lib/seo/sitemap leaves them out.
    expect(entries.find((e) => e.path === "/p/hidden")).toMatchObject({
      noindex: true,
    })
    expect(entries.map((e) => e.path)).not.toContain("/p/draft-only")
    const urls = buildSitemap(entries, "https://example.ie").map((e) => e.url)
    expect(urls).toContain("https://example.ie/p/published")
    expect(urls).not.toContain("https://example.ie/p/hidden")
  })

  it("OG kind builder: the page title by id, published only", async () => {
    const row = await insertPage("published", { title: "Landing page" })
    const draft = await insertPage("draft-only", { published: false })
    expect(isOgSubjectId("builder", row.id)).toBe(true)
    expect(isOgSubjectId("builder", "published")).toBe(false)
    expect(await getOgSubject("builder", row.id)).toMatchObject({
      kind: "builder",
      title: "Landing page",
    })
    expect(await getOgSubject("builder", draft.id)).toBeNull()
  })
})

describe("visual fixture /p/visual-fixture (tests/visual/seed.ts)", () => {
  it("is publishable and has every block type", async () => {
    await seedVisualBuilderPage(getDb())
    const [row] = await getDb()
      .select()
      .from(builderPages)
      .where(eq(builderPages.slug, VISUAL_BUILDER_SLUG))
    const types = new Set(
      (row.published as BuilderDocument).blocks.map((b) => b.type)
    )
    expect([...types].sort()).toEqual([...BLOCK_TYPES].sort())
    expect(await resolvePublicPath(`/p/${VISUAL_BUILDER_SLUG}`, live)).toEqual({
      kind: "pass",
    })
  })

  it("stores no reserved anchor: its draft opens in the builder (review D5.5 I2)", async () => {
    await seedVisualBuilderPage(getDb())
    const [row] = await getDb()
      .select()
      .from(builderPages)
      .where(eq(builderPages.slug, VISUAL_BUILDER_SLUG))
    for (const stored of [row.draft, row.published]) {
      expect(DraftDocument.safeParse(stored).success).toBe(true)
      expect(validateDocument(stored).ok).toBe(true)
      for (const block of (stored as BuilderDocument).blocks)
        if (Object.hasOwn(RESERVED_ANCHORS, block.anchor))
          expect(RESERVED_ANCHORS[block.anchor]).toBe(block.type)
    }
  })
})

describe("preview: builder-page (D5.3)", () => {
  const open = (query: string, cookie?: string) =>
    app.request(`/api/v1/admin/preview?${query}`, {
      headers: {
        "sec-fetch-site": "same-origin",
        ...(cookie ? { cookie } : {}),
      },
    })

  it("redirects to /p/<slug> of an unpublished page, after the uuid check", async () => {
    const { cookie } = await signedInUser(["viewer"])
    const row = await insertPage("draft-only", { published: false })
    const res = await open(`entity=builder-page&id=${row.id}`, cookie)
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/p/draft-only")
    expect(enable).toHaveBeenCalledTimes(1)
    expect(
      (await open("entity=builder-page&id=not-a-uuid", cookie)).status
    ).toBe(404)
    expect(
      (
        await open(
          "entity=builder-page&id=00000000-0000-4000-8000-000000000000",
          cookie
        )
      ).status
    ).toBe(404)
  })

  it("needs page:read", async () => {
    const { cookie } = await signedInUser(["intake"])
    const row = await insertPage("draft-only", { published: false })
    expect(
      (await open(`entity=builder-page&id=${row.id}`, cookie)).status
    ).toBe(403)
  })
})
