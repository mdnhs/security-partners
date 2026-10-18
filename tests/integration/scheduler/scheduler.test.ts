import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { ArticleDto } from "@/lib/schemas/api/articles"
import { getDb } from "@/server/db/client"
import {
  articleCategories,
  articles,
  auditLog,
  jobs,
  media,
  revisions,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { RECURRING_JOBS } from "@/server/lib/jobs"
import { publishScheduledJob } from "@/server/lib/jobs/publish-scheduled"
import {
  pruneRevisionsJob,
  REVISIONS_KEPT,
} from "@/server/lib/jobs/prune-revisions"
import {
  ensureRecurringJobs,
  LOCK_TIMEOUT_MS,
  RETRY_DELAY_MS,
  tick,
} from "@/server/lib/scheduler"
import { publishDueArticles } from "@/server/modules/articles/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let categoryId: string
let coverId: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  const db = getDb()
  const [category] = await db
    .select()
    .from(articleCategories)
    .where(eq(articleCategories.slug, "company-news"))
  categoryId = category.id
  const [hero] = await db
    .select()
    .from(media)
    .where(eq(media.key, "/images/hero.jpg"))
  coverId = hero.id
  revalidateTag.mockClear()
})

/** Creates an article through the API and schedules it `inMs` from now. */
async function scheduled(slug: string, inMs = 60_000) {
  const created = await adminRequest("/articles", {
    cookie: editor,
    method: "POST",
    json: {
      slug,
      categoryId,
      draft: {
        title: `Timed ${slug}`,
        excerpt: "Goes live by itself.",
        cover: { mediaId: coverId },
        lead: null,
        tags: [],
        body: null,
      },
    },
  })
  expect(created.status).toBe(201)
  const article = (await created.json()) as ArticleDto
  const res = await adminRequest(`/articles/${article.id}/schedule`, {
    cookie: editor,
    method: "POST",
    json: {
      version: 1,
      scheduledAt: new Date(Date.now() + inMs).toISOString(),
    },
  })
  expect(res.status).toBe(200)
  return article.id
}

/** A moment after every schedule above (the scheduler's clock is injected). */
const later = () => new Date(Date.now() + 5 * 60_000)

async function job(key: string) {
  const [row] = await getDb().select().from(jobs).where(eq(jobs.key, key))
  return row
}

async function article(id: string) {
  const [row] = await getDb().select().from(articles).where(eq(articles.id, id))
  return row
}

const publishedAudits = (id: string) =>
  getDb()
    .select({ actorId: auditLog.actorId })
    .from(auditLog)
    .where(
      and(eq(auditLog.entityId, id), eq(auditLog.action, "article.published"))
    )

describe("scheduler (master 5.4)", () => {
  it("two concurrent ticks publish a due article exactly once (FOR UPDATE SKIP LOCKED)", async () => {
    const id = await scheduled("timed-update")
    await ensureRecurringJobs(new Date())
    const revalidate = vi.fn(async () => undefined)
    const now = later()
    const [a, b] = await Promise.all([
      tick({ now, revalidate }),
      tick({ now, revalidate }),
    ])
    const runs = [...a, ...b].filter((r) => r.name === "publish-scheduled")
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      ok: true,
      error: null,
      tags: ["articles", "article:timed-update"],
    })
    expect(revalidate).toHaveBeenCalledTimes(1)
    expect(revalidate).toHaveBeenCalledWith([
      "articles",
      "article:timed-update",
    ])

    const row = await article(id)
    expect(row).toMatchObject({ status: "published", scheduledAt: null })
    expect(row.published).toEqual(row.draft)
    expect(row.publishedAt?.getTime()).toBe(now.getTime())
    const audits = await publishedAudits(id)
    expect(audits).toEqual([{ actorId: null }])
    // The timer never calls revalidateTag itself (ledger ruling).
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("publishDueArticles run twice at once publishes each article once (row locks)", async () => {
    const ids = [
      await scheduled("first-timed"),
      await scheduled("second-timed"),
    ]
    const now = later()
    const results = await Promise.all([
      publishDueArticles(now),
      publishDueArticles(now),
    ])
    expect(results.flatMap((r) => r.published).sort()).toEqual([
      "first-timed",
      "second-timed",
    ])
    for (const id of ids) expect(await publishedAudits(id)).toHaveLength(1)
  })

  it("an article that cannot be published is reported; the others go live", async () => {
    const bad = await scheduled("broken-timed")
    await scheduled("good-timed")
    const row = await article(bad)
    await getDb()
      .update(articles)
      .set({ draft: { ...row.draft, title: "" } })
      .where(eq(articles.id, bad))
    const result = await publishScheduledJob.run({
      now: later(),
      payload: null,
    })
    expect(result.tags).toEqual(["articles", "article:good-timed"])
    expect(result.warning).toContain("broken-timed")
    expect((await article(bad)).status).toBe("scheduled")
  })

  it("records failures in jobs.last_error, retries in a minute, clears them on success", async () => {
    await ensureRecurringJobs(new Date())
    const now = later()
    const failing = {
      ...publishScheduledJob,
      run: async () => {
        throw new Error("boom")
      },
    }
    await tick({ now, jobs: [failing, pruneRevisionsJob], revalidate: vi.fn() })
    const failed = await job("publish-scheduled")
    expect(failed).toMatchObject({
      lastError: "boom",
      lockedAt: null,
      attempts: 1,
    })
    expect(failed.runAt.getTime()).toBe(now.getTime() + RETRY_DELAY_MS)

    const retry = new Date(now.getTime() + RETRY_DELAY_MS)
    await tick({ now: retry, revalidate: vi.fn() })
    const ok = await job("publish-scheduled")
    expect(ok).toMatchObject({ lastError: null, attempts: 0, lockedAt: null })
    expect(ok.lastRunAt?.getTime()).toBe(retry.getTime())
  })

  it("keeps one row per recurring job key and its schedule (ON CONFLICT (key))", async () => {
    await ensureRecurringJobs(new Date())
    const now = later()
    await tick({ now, revalidate: vi.fn() })
    const before = await job("prune-revisions")
    expect(before.runAt.getTime()).toBe(
      now.getTime() + pruneRevisionsJob.everyMs
    )
    await ensureRecurringJobs(new Date())
    const rows = await getDb().select().from(jobs)
    expect(rows.map((r) => r.key).sort()).toEqual(
      RECURRING_JOBS.map((j) => j.key).sort()
    )
    expect((await job("prune-revisions")).runAt).toEqual(before.runAt)
  })

  it("takes over a crashed worker's claim after the lock timeout, not before", async () => {
    await ensureRecurringJobs(new Date())
    const now = later()
    const lockAgo = (ms: number) =>
      getDb()
        .update(jobs)
        .set({ lockedAt: new Date(now.getTime() - ms) })
        .where(eq(jobs.key, "publish-scheduled"))
    await lockAgo(60_000)
    expect(
      (await tick({ now, revalidate: vi.fn() })).map((r) => r.name)
    ).not.toContain("publish-scheduled")
    await lockAgo(LOCK_TIMEOUT_MS + 1_000)
    expect(
      (await tick({ now, revalidate: vi.fn() })).map((r) => r.name)
    ).toContain("publish-scheduled")
  })

  it("revision pruning keeps the newest 50 per entity", async () => {
    const db = getDb()
    await db.insert(revisions).values([
      ...Array.from({ length: 55 }, (_, i) => ({
        entityType: "page",
        entityId: "prune-a",
        version: i + 1,
        data: {},
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        entityType: "page",
        entityId: "prune-b",
        version: i + 1,
        data: {},
      })),
    ])
    await pruneRevisionsJob.run({ now: new Date(), payload: null })
    const versions = async (entityId: string) =>
      (
        await db
          .select({ version: revisions.version })
          .from(revisions)
          .where(
            and(
              eq(revisions.entityType, "page"),
              eq(revisions.entityId, entityId)
            )
          )
      )
        .map((r) => r.version)
        .sort((x, y) => x - y)
    expect(REVISIONS_KEPT).toBe(50)
    expect(await versions("prune-a")).toEqual(
      Array.from({ length: 50 }, (_, i) => i + 6)
    )
    expect(await versions("prune-b")).toEqual([1, 2, 3])
  })
})
