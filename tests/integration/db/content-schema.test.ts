import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import {
  aiConversations,
  aiMessages,
  articleCategories,
  articles,
  clients,
  jobs,
  media,
  mediaUsages,
  pages,
  redirects,
  revisions,
  services,
  users,
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

const mediaRow = {
  key: "/images/logo.svg",
  driver: "static" as const,
  mime: "image/svg+xml",
  size: 1,
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

  it("only allows 301/302/307/308 redirects (widened in D1.7)", async () => {
    const db = getDb()
    await db.insert(redirects).values({ fromPath: "/a", toPath: "/b" })
    await db
      .insert(redirects)
      .values({ fromPath: "/e", toPath: "/f", code: 307 })
    expect(
      await pgCode(
        db.insert(redirects).values({ fromPath: "/c", toPath: "/d", code: 303 })
      )
    ).toBe("23514")
  })

  it("rejects self-redirects and relative from paths (23514)", async () => {
    const db = getDb()
    expect(
      await pgCode(
        db.insert(redirects).values({ fromPath: "/a", toPath: "/a" })
      )
    ).toBe("23514")
    expect(
      await pgCode(db.insert(redirects).values({ fromPath: "a", toPath: "/b" }))
    ).toBe("23514")
  })

  it("will not delete media that is in use (23503)", async () => {
    const db = getDb()
    const [row] = await db.insert(media).values(mediaRow).returning()
    await db.insert(mediaUsages).values({
      mediaId: row.id,
      entityType: "service",
      entityId: "x",
      field: "icon",
    })
    expect(await pgCode(db.delete(media).where(eq(media.id, row.id)))).toBe(
      "23503"
    )
  })

  it("will not delete media used as a client logo (23503)", async () => {
    const db = getDb()
    const [row] = await db.insert(media).values(mediaRow).returning()
    await db.insert(clients).values({ name: "Acme", logoId: row.id })
    expect(await pgCode(db.delete(media).where(eq(media.id, row.id)))).toBe(
      "23503"
    )
  })

  it("keeps job keys unique but allows many unkeyed jobs", async () => {
    const db = getDb()
    const runAt = new Date()
    const [job] = await db
      .insert(jobs)
      .values({ name: "publish", key: "publish:a", runAt })
      .returning()
    expect(job.attempts).toBe(0)
    expect(
      await pgCode(
        db.insert(jobs).values({ name: "publish", key: "publish:a", runAt })
      )
    ).toBe("23505")
    await db.insert(jobs).values([
      { name: "sweep", runAt },
      { name: "sweep", runAt },
    ])
  })

  it("keeps one revision per entity version (23505)", async () => {
    const db = getDb()
    const row = { entityType: "page", entityId: "home", version: 1, data: {} }
    await db.insert(revisions).values(row)
    expect(await pgCode(db.insert(revisions).values(row))).toBe("23505")
    await db.insert(revisions).values({ ...row, version: 2 })
  })

  it("only allows known ai message roles (23514)", async () => {
    const db = getDb()
    const [user] = await db
      .insert(users)
      .values({ name: "U", email: "u@example.test" })
      .returning()
    const [conversation] = await db
      .insert(aiConversations)
      .values({ userId: user.id, title: "T" })
      .returning()
    for (const role of ["user", "assistant", "system", "tool"] as const)
      await db
        .insert(aiMessages)
        .values({ conversationId: conversation.id, role, content: "c" })
    expect(
      await pgCode(
        db.insert(aiMessages).values({
          conversationId: conversation.id,
          role: "bot" as "user",
          content: "c",
        })
      )
    ).toBe("23514")
  })
})
