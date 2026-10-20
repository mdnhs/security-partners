import { and, eq, sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { getDb } from "@/server/db/client"
import { media, mediaUsages, pages, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { backfillMediaUsages, syncMediaUsages } from "@/server/lib/media-usages"

import { resetDb } from "../db"

const idOf = async (key: string) =>
  (
    await getDb().select({ id: media.id }).from(media).where(eq(media.key, key))
  )[0].id

const usagesOf = (entityType: string, entityId: string) =>
  getDb()
    .select({ mediaId: mediaUsages.mediaId, field: mediaUsages.field })
    .from(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId)
      )
    )
    .orderBy(mediaUsages.field, mediaUsages.mediaId)

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
})
afterEach(() => vi.restoreAllMocks())

async function lockWaiters(n: number) {
  await vi.waitFor(
    async () => {
      const { rows } = await getDb().execute<{ n: number }>(
        sql`select count(*)::int as n from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`
      )
      expect(rows[0].n).toBe(n)
    },
    { timeout: 10_000, interval: 50 }
  )
}

describe("usages backfill hardening", () => {
  it("waits for a concurrent save and keeps its references (no stale overwrite)", async () => {
    const [page] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "home"))
    const bannerId = await idOf("/images/banner.png")
    const draft = structuredClone(page.draft) as {
      hero: { backgroundImage: { mediaId: string } }
    }
    draft.hero.backgroundImage = { mediaId: bannerId }

    // An admin save of the home page, still open when the backfill starts.
    let release: (() => void) | undefined
    const save = getDb().transaction(async (tx) => {
      await tx
        .update(pages)
        .set({ draft: draft as typeof page.draft })
        .where(eq(pages.key, "home"))
      await syncMediaUsages(tx, "page", "home", draft, page.published)
      await new Promise<void>((resolve) => (release = resolve))
    })
    await vi.waitFor(() => expect(release).toBeDefined())

    const backfill = backfillMediaUsages(getDb())
    await lockWaiters(1)
    release!()
    await save
    await backfill

    expect(await usagesOf("page", "home")).toContainEqual({
      mediaId: bannerId,
      field: "hero.backgroundImage",
    })
  })

  it("skips an entity with a missing media reference, logs its id and keeps going", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const [service] = await getDb().select().from(services).limit(1)
    const before = await usagesOf("service", service.id)
    const ghost = "01900000-0000-7000-8000-00000000dead"
    await getDb()
      .update(services)
      .set({
        draft: {
          ...(service.draft as Record<string, unknown>),
          heroImage: { mediaId: ghost },
        } as unknown as typeof service.draft,
      })
      .where(eq(services.id, service.id))
    // Other entities' rows are rebuilt from scratch to prove the run went on.
    await getDb().delete(mediaUsages).where(eq(mediaUsages.entityType, "page"))

    await expect(backfillMediaUsages(getDb())).resolves.toBeGreaterThan(0)

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]).toEqual([
      `[media] usages backfill skipped entities with missing media: service:${service.id}`,
    ])
    expect(await usagesOf("service", service.id)).toEqual(before)
    expect((await usagesOf("page", "home")).length).toBeGreaterThan(0)
  })

  it("does not roll back a seed when a reference dangles", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    await expect(seedContent(getDb())).resolves.toBeDefined()
  })
})
