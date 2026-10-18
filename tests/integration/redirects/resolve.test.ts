import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { articles, redirects, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { resolvePublicPath } from "@/server/modules/redirects/resolve"

import { resetDb } from "../db"

const live = { draft: false }

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("resolvePublicPath against the database", () => {
  it("published slugs pass, unknown and unpublished ones are missing", async () => {
    expect(await resolvePublicPath("/services/alarm-responses", live)).toEqual({
      kind: "pass",
    })
    expect(await resolvePublicPath("/blog/no-such-article", live)).toEqual({
      kind: "missing",
    })
    await getDb()
      .update(services)
      .set({ published: null })
      .where(eq(services.slug, "event-security"))
    expect(await resolvePublicPath("/services/event-security", live)).toEqual({
      kind: "missing",
    })
  })

  it("a redirect hit increments hits once and leaves updatedAt alone", async () => {
    const [row] = await getDb()
      .insert(redirects)
      .values({ fromPath: "/old-alarms", toPath: "/services/alarm-responses" })
      .returning()
    const outcome = await resolvePublicPath("/old-alarms", live)
    expect(outcome).toMatchObject({
      kind: "redirect",
      to: "/services/alarm-responses",
      code: 301,
    })
    if (outcome.kind === "redirect") await outcome.recordHit()
    const [after] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.id, row.id))
    expect(after.hits).toBe(1)
    expect(after.updatedAt.getTime()).toBe(row.updatedAt.getTime())
  })

  it("a burst of hits is counted exactly (coalesced writes lose nothing)", async () => {
    const [row] = await getDb()
      .insert(redirects)
      .values({ fromPath: "/burst", toPath: "/services/alarm-responses" })
      .returning()
    const outcome = await resolvePublicPath("/burst", live)
    if (outcome.kind !== "redirect") throw new Error("expected a redirect")
    await Promise.all(Array.from({ length: 40 }, () => outcome.recordHit()))
    const [after] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.id, row.id))
    expect(after.hits).toBe(40)
  })

  it("an unpublished article 404s unless a stored redirect covers it", async () => {
    const [article] = await getDb()
      .select({ slug: articles.slug })
      .from(articles)
      .limit(1)
    const path = `/blog/${article.slug}`
    expect(await resolvePublicPath(path, live)).toEqual({ kind: "pass" })
    await getDb()
      .update(articles)
      .set({ published: null })
      .where(eq(articles.slug, article.slug))
    expect(await resolvePublicPath(path, live)).toEqual({ kind: "missing" })
    await getDb()
      .insert(redirects)
      .values({ fromPath: path, toPath: "/blog", code: 302 })
    expect(await resolvePublicPath(path, live)).toMatchObject({
      kind: "redirect",
      to: "/blog",
      code: 302,
    })
  })
})
