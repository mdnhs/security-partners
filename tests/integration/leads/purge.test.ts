import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { getDb } from "@/server/db/client"
import {
  aiConversations,
  aiMessages,
  auditLog,
  jobs,
  leadEvents,
  leads,
  publicRateLimits,
  settings,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { RECURRING_JOBS } from "@/server/lib/jobs"
import { purgeLeadsJob } from "@/server/lib/jobs/purge-leads"
import { deleteLeadsCreatedBefore } from "@/server/modules/leads/repo"
import { ensureRecurringJobs, tick } from "@/server/lib/scheduler"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

const NOW = new Date("2026-10-16T12:00:00.000Z")

async function addLead(name: string, createdAt: Date) {
  const [row] = await getDb()
    .insert(leads)
    .values({ name, email: `${name}@example.ie`, message: "Hi", createdAt })
    .returning()
  await getDb()
    .insert(leadEvents)
    .values({ leadId: row.id, type: "created", body: null, actorId: null })
  return row
}

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb()) // settings.leads published: retentionMonths 24
})

describe("purge-leads job (spec §9 retention, §12)", () => {
  it("deletes leads older than retentionMonths with their events, keeps newer ones, audits", async () => {
    await addLead("ancient", new Date("2024-10-15T11:59:59.000Z"))
    const kept = await addLead("recent", new Date("2024-10-16T12:00:01.000Z"))
    await getDb()
      .insert(publicRateLimits)
      .values([
        { key: "leads:old", count: 3, resetAt: new Date(NOW.getTime() - 1000) },
        {
          key: "leads:live",
          count: 1,
          resetAt: new Date(NOW.getTime() + 60_000),
        },
      ])

    const result = await purgeLeadsJob.run({ now: NOW, payload: null })
    expect(result.warning).toBeUndefined()

    expect((await getDb().select().from(leads)).map((l) => l.id)).toEqual([
      kept.id,
    ])
    expect(await getDb().select().from(leadEvents)).toHaveLength(1)
    expect(
      (await getDb().select().from(publicRateLimits)).map((r) => r.key)
    ).toEqual(["leads:live"])
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "lead.purged"))
    expect(audit).toMatchObject({ actorId: null })
    expect(audit.diff).toEqual({ count: 1, cutoff: "2024-10-16T12:00:00.000Z" })
  })

  it("also erases AI conversations opened on purged leads, in batches (final review I3)", async () => {
    const user = await createUser({ roles: ["admin"] })
    const openOn = async (leadId: string) => {
      const [row] = await getDb()
        .insert(aiConversations)
        .values({
          userId: user.id,
          title: "Summary",
          context: {
            screen: "Lead details",
            entityType: "lead",
            entityId: leadId,
          },
        })
        .returning()
      await getDb()
        .insert(aiMessages)
        .values({ conversationId: row.id, role: "assistant", content: "x" })
    }
    const entityIds = async () =>
      (await getDb().select().from(aiConversations)).map(
        (c) => (c.context as { entityId: string }).entityId
      )

    // Several batches (size 1): every batch erases its conversations.
    for (const year of [2021, 2022, 2023])
      await openOn((await addLead(`old${year}`, new Date(`${year}-01-01`))).id)
    expect(await deleteLeadsCreatedBefore(getDb(), NOW, 1)).toBe(3)
    expect(await entityIds()).toEqual([])
    expect(await getDb().select().from(aiMessages)).toEqual([])

    // The daily job: only the purged leads' conversations go.
    await openOn((await addLead("ancient", new Date("2024-01-01"))).id)
    const kept = await addLead("recent", new Date("2026-10-01"))
    await openOn(kept.id)
    await purgeLeadsJob.run({ now: NOW, payload: null })
    expect(await entityIds()).toEqual([kept.id])
  })

  it("does nothing (with a warning) while settings.leads is unpublished", async () => {
    await addLead("ancient", new Date("2000-01-01T00:00:00.000Z"))
    await getDb()
      .update(settings)
      .set({ published: null })
      .where(eq(settings.key, "leads"))
    const result = await purgeLeadsJob.run({ now: NOW, payload: null })
    expect(result.warning).toBe(
      "settings.leads is not published; no leads purged"
    )
    expect(await getDb().select().from(leads)).toHaveLength(1)
  })

  it("still clears expired rate limits; audits nothing when nothing was purged", async () => {
    await addLead("recent", new Date(NOW.getTime() - 86_400_000))
    await getDb()
      .insert(publicRateLimits)
      .values({
        key: "leads:old",
        count: 3,
        resetAt: new Date(NOW.getTime() - 1000),
      })
    expect(await purgeLeadsJob.run({ now: NOW, payload: null })).toEqual({})
    expect(await getDb().select().from(publicRateLimits)).toEqual([])
    expect(await getDb().select().from(leads)).toHaveLength(1)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "lead.purged"))
    ).toEqual([])

    await getDb()
      .insert(publicRateLimits)
      .values({
        key: "leads:old",
        count: 3,
        resetAt: new Date(NOW.getTime() - 1000),
      })
    await getDb()
      .update(settings)
      .set({ published: null })
      .where(eq(settings.key, "leads"))
    await purgeLeadsJob.run({ now: NOW, payload: null })
    expect(await getDb().select().from(publicRateLimits)).toEqual([])
  })

  it("is a daily keyed recurring job the scheduler runs", async () => {
    expect(RECURRING_JOBS.map((j) => j.key)).toContain("purge-leads")
    expect(purgeLeadsJob.everyMs).toBe(24 * 60 * 60_000)
    await addLead("ancient", new Date(Date.now() - 30 * 31 * 86_400_000))
    await ensureRecurringJobs(new Date())
    await tick({ now: new Date(Date.now() + 60_000), revalidate: vi.fn() })
    const [row] = await getDb()
      .select()
      .from(jobs)
      .where(eq(jobs.key, "purge-leads"))
    expect(row.lastError).toBeNull()
    expect(row.lastRunAt).not.toBeNull()
    expect(await getDb().select().from(leads)).toHaveLength(0)
  })

  it("keeps a lead created exactly at the cutoff", async () => {
    const atCutoff = await addLead("edge", new Date("2024-10-16T12:00:00.000Z"))
    await purgeLeadsJob.run({ now: NOW, payload: null })
    expect((await getDb().select().from(leads)).map((l) => l.id)).toEqual([
      atCutoff.id,
    ])
  })

  it("deletes in batches until none are left and returns the total", async () => {
    for (let i = 0; i < 5; i++)
      await addLead(`old${i}`, new Date("2020-01-01T00:00:00.000Z"))
    const kept = await addLead("new", NOW)
    expect(
      await deleteLeadsCreatedBefore(getDb(), new Date("2021-01-01"), 2)
    ).toBe(5)
    expect(
      await deleteLeadsCreatedBefore(getDb(), new Date("2021-01-01"), 2)
    ).toBe(0)
    expect((await getDb().select().from(leads)).map((l) => l.id)).toEqual([
      kept.id,
    ])
  })
})
