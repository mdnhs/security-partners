import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import {
  articleCategories,
  articles,
  media,
  pages,
  redirects,
  services,
} from "@/server/db/schema"

import { resetDb } from "../db"

const CONTENT_TABLES = [
  "ai_conversations",
  "ai_messages",
  "article_categories",
  "articles",
  "clients",
  "group_companies",
  "jobs",
  "lead_events",
  "leads",
  "media",
  "media_usages",
  "pages",
  "redirects",
  "revisions",
  "services",
  "settings",
  "team_members",
]

const serviceContent = {
  title: "T",
  description: "D",
  icon: { mediaId: "00000000-0000-7000-8000-000000000001" },
  heroImage: { mediaId: "00000000-0000-7000-8000-000000000001" },
  image: { mediaId: "00000000-0000-7000-8000-000000000001" },
  imageAlt: "A",
  detail: {
    intro: "I",
    heading: "H",
    overview: {
      type: "doc" as const,
      content: [{ type: "paragraph" as const }],
    },
    included: ["x"],
    callout: "C",
  },
}

/** Postgres error code of a rejected statement (drizzle wraps it in `cause`). */
async function pgCode(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run
    return undefined
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } }
    return e.cause?.code ?? e.code
  }
}

beforeEach(resetDb)

describe("content schema migration (0003_content)", () => {
  it("creates every content table", async () => {
    const { rows } = await getDb().execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public' order by tablename`
    )
    const names = rows.map((r) => r.tablename)
    for (const table of CONTENT_TABLES) expect(names).toContain(table)
  })

  it("defaults versioned rows to draft, version 1, empty seo", async () => {
    const db = getDb()
    const [row] = await db
      .insert(pages)
      .values({ key: "home", template: "home", draft: { a: 1 } })
      .returning()
    expect(row).toMatchObject({
      status: "draft",
      version: 1,
      seo: {},
      published: null,
      publishedAt: null,
    })
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
  })

  it("rejects malformed slugs (23514) and duplicates (23505)", async () => {
    const db = getDb()
    expect(
      await pgCode(
        db.insert(services).values({ slug: "Bad Slug", draft: serviceContent })
      )
    ).toBe("23514")
    await db.insert(services).values({ slug: "ok-slug", draft: serviceContent })
    expect(
      await pgCode(
        db.insert(services).values({ slug: "ok-slug", draft: serviceContent })
      )
    ).toBe("23505")
  })

  it("will not delete a category that has articles (23503)", async () => {
    const db = getDb()
    const [category] = await db
      .insert(articleCategories)
      .values({ slug: "news", name: "News" })
      .returning()
    await db.insert(articles).values({
      slug: "a",
      categoryId: category.id,
      draft: {
        title: "T",
        excerpt: "E",
        cover: { mediaId: "00000000-0000-7000-8000-000000000001" },
        lead: null,
        tags: [],
        body: null,
      },
    })
    expect(
      await pgCode(
        db
          .delete(articleCategories)
          .where(eq(articleCategories.id, category.id))
      )
    ).toBe("23503")
  })

  it("keeps one media row per driver + key", async () => {
    const db = getDb()
    const row = {
      key: "/images/hero.jpg",
      driver: "static" as const,
      mime: "image/jpeg",
      size: 1,
    }
    await db.insert(media).values(row)
    expect(await pgCode(db.insert(media).values(row))).toBe("23505")
    await db.insert(media).values({ ...row, driver: "disk" })
  })

  it("only allows 301/302 redirects", async () => {
    const db = getDb()
    await db.insert(redirects).values({ fromPath: "/a", toPath: "/b" })
    expect(
      await pgCode(
        db.insert(redirects).values({ fromPath: "/c", toPath: "/d", code: 307 })
      )
    ).toBe("23514")
  })
})
