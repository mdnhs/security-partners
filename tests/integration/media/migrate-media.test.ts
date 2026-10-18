import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { MediaMigrationStatus } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import { auditLog, jobs, media, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { ALL_JOBS } from "@/server/lib/jobs"
import {
  MIGRATE_MEDIA_JOB,
  migrateMediaJob,
  migrationOutcome,
} from "@/server/lib/jobs/migrate-media"
import {
  ensureRecurringJobs,
  PARKED_RUN_AT,
  RETRY_DELAY_MS,
  tick,
} from "@/server/lib/scheduler"
import type { Actor } from "@/server/lib/actor"
import { diskStorage, type StorageDriver } from "@/server/lib/storage"
import { enqueueKeyedJob } from "@/server/modules/jobs/repo"
import {
  migrateDiskMediaToR2,
  replaceMedia,
} from "@/server/modules/media/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

/** In-memory R2 stand-in (the real driver is unit-tested in Task 3). */
function memoryR2(
  failKeys: string[] = []
): StorageDriver & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>()
  return {
    name: "r2",
    objects,
    async put(key, body) {
      if (failKeys.includes(key)) throw new Error("R2 put failed")
      objects.set(key, body)
    },
    async read(key) {
      return objects.get(key) ?? null
    },
    async delete(key) {
      objects.delete(key)
    },
    url: (key) => `/api/v1/media/file/${key}`,
    async test() {},
  }
}

let root: string
let disk: StorageDriver
const KEYS = [1, 2, 3].map(
  (n) => `2026/10/0190a6e0-0000-7000-8000-00000000000${n}.png`
)

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  root = await mkdtemp(join(tmpdir(), "sp-migrate-"))
  disk = diskStorage(root)
  for (const key of KEYS) {
    await disk.put(key, new Uint8Array([1, 2, 3]), "image/png")
    await getDb()
      .insert(media)
      .values({ key, driver: "disk", mime: "image/png", size: 3 })
  }
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const drivers = async () =>
  Object.fromEntries(
    (
      await getDb().select({ key: media.key, driver: media.driver }).from(media)
    ).map((r) => [r.key, r.driver])
  )

describe("migrateDiskMediaToR2 (master 6.4)", () => {
  it("moves disk files, flips the driver, keeps keys and skips static rows", async () => {
    const r2 = memoryR2()
    const result = await migrateDiskMediaToR2({
      deadline: Date.now() + 30_000,
      r2,
      disk,
    })
    expect(result).toEqual({
      moved: 3,
      failed: [],
      remaining: 0,
      configured: true,
    })
    const after = await drivers()
    for (const key of KEYS) {
      expect(after[key]).toBe("r2")
      expect([...(r2.objects.get(key) ?? [])]).toEqual([1, 2, 3])
      expect(await disk.read(key)).toBeNull()
    }
    expect(after["/images/hero.jpg"]).toBe("static")
  })

  it("is idempotent and reports failures without losing files", async () => {
    const r2 = memoryR2([KEYS[1]])
    const first = await migrateDiskMediaToR2({
      deadline: Date.now() + 30_000,
      r2,
      disk,
    })
    expect(first.moved).toBe(2)
    expect(first.failed).toEqual([expect.stringContaining("R2 put failed")])
    expect(first.remaining).toBe(1)
    expect(await disk.read(KEYS[1])).not.toBeNull()
    const again = await migrateDiskMediaToR2({
      deadline: Date.now() + 30_000,
      r2: memoryR2(),
      disk,
    })
    expect(again).toMatchObject({ moved: 1, remaining: 0 })
    expect(
      await migrateDiskMediaToR2({
        deadline: Date.now() + 30_000,
        r2: memoryR2(),
        disk,
      })
    ).toMatchObject({ moved: 0, remaining: 0 })
  })

  it("stops at the deadline and continues later", async () => {
    const result = await migrateDiskMediaToR2({
      deadline: Date.now() - 1,
      r2: memoryR2(),
      disk,
    })
    expect(result).toMatchObject({ moved: 0, remaining: 3 })
  })

  it("does nothing when R2 is not configured", async () => {
    expect(
      await migrateDiskMediaToR2({ deadline: Date.now() + 30_000, disk })
    ).toEqual({
      moved: 0,
      failed: [],
      remaining: 3,
      configured: false,
    })
  })
})

describe("migrate-media job + routes", () => {
  const status = async (cookie: string) => {
    const res = await adminRequest(
      "/integrations/integrations.r2/migrate-media",
      { cookie }
    )
    return {
      status: res.status,
      body: (await res.json()) as MediaMigrationStatus,
    }
  }

  it("422 until R2 is set up; viewers and editors are refused", async () => {
    const owner = (await signedInUser(["owner"])).cookie
    const editor = (await signedInUser(["editor"])).cookie
    expect((await status(owner)).body).toMatchObject({
      r2Configured: false,
      onDisk: 3,
      inR2: 0,
      state: "idle",
    })
    expect((await status(editor)).status).toBe(403)
    const start = await adminRequest(
      "/integrations/integrations.r2/migrate-media",
      { cookie: owner, method: "POST" }
    )
    expect(start.status).toBe(422)
  })

  it("queues one keyed job; a finished run deletes its row", async () => {
    const owner = (await signedInUser(["owner"])).cookie
    await adminRequest("/integrations/integrations.r2", {
      cookie: owner,
      method: "PUT",
      json: {
        version: 0,
        values: {
          accountId: "0123456789abcdef0123456789abcdef",
          jurisdiction: "default",
          bucket: "sp-media",
          accessKeyId: "AKID",
          secretAccessKey: "SECRET",
        },
      },
    })
    for (let i = 0; i < 2; i++) {
      const res = await adminRequest(
        "/integrations/integrations.r2/migrate-media",
        { cookie: owner, method: "POST" }
      )
      expect(res.status).toBe(202)
      expect(((await res.json()) as MediaMigrationStatus).state).toBe("queued")
    }
    expect(
      await getDb()
        .select()
        .from(jobs)
        .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
    ).toHaveLength(1)

    // Run the job with the in-memory R2 + temp disk (same definition, injected storage).
    const r2 = memoryR2()
    const job = {
      ...ALL_JOBS.find((j) => j.name === MIGRATE_MEDIA_JOB.name)!,
      run: async () => {
        const result = await migrateDiskMediaToR2({
          deadline: Date.now() + 30_000,
          r2,
          disk,
        })
        return { done: result.remaining === 0 }
      },
    }
    const [result] = await tick({
      now: new Date(),
      jobs: [job],
      revalidate: async () => undefined,
    })
    expect(result).toMatchObject({ name: "migrate-media", ok: true })
    expect(
      await getDb()
        .select()
        .from(jobs)
        .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
    ).toEqual([])
    expect((await status(owner)).body).toMatchObject({
      r2Configured: true,
      onDisk: 0,
      inR2: 3,
      state: "idle",
    })
  })
})

describe("migration safety (copy-then-switch, R2 guard, fixed messages)", () => {
  const R2_VALUES = {
    accountId: "0123456789abcdef0123456789abcdef",
    jurisdiction: "default",
    bucket: "sp-media",
    accessKeyId: "AKID",
    secretAccessKey: "SECRET",
  }
  const saveR2 = async (cookie: string) => {
    const res = await adminRequest("/integrations/integrations.r2", {
      cookie,
      method: "PUT",
      json: { version: 0, values: R2_VALUES },
    })
    expect(res.status).toBe(200)
  }
  /** memoryR2 that runs `hook` after storing `key` (a concurrent request landing mid-copy). */
  function hookedR2(key: string, hook: () => Promise<void>) {
    const r2 = memoryR2()
    const put = r2.put.bind(r2)
    r2.put = async (k, body, mime) => {
      await put(k, body, mime)
      if (k === key) await hook()
    }
    return r2
  }

  it("a replace landing mid-copy wins (replaceMedia): the copy is removed and the new file moves too", async () => {
    const { user } = await signedInUser(["owner"])
    const actor: Actor = {
      userId: user.id,
      roles: ["owner"],
      ip: null,
      userAgent: null,
      impersonatorId: null,
    }
    const [target] = await getDb()
      .select()
      .from(media)
      .where(eq(media.key, KEYS[0]))
    // replaceMedia stores on the default disk root; the migration reads both.
    const defaultDisk = diskStorage()
    const bothDisks: StorageDriver = {
      ...disk,
      async read(key) {
        return (await disk.read(key)) ?? (await defaultDisk.read(key))
      },
      async delete(key) {
        await disk.delete(key)
        await defaultDisk.delete(key)
      },
    }
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer()
    const r2 = hookedR2(KEYS[0], async () => {
      await replaceMedia(actor, target.id, {
        file: new File([new Uint8Array(png)], "new.png", { type: "image/png" }),
      })
    })
    const result = await migrateDiskMediaToR2({
      deadline: Date.now() + 30_000,
      r2,
      disk: bothDisks,
    })
    const [replaced] = await getDb()
      .select()
      .from(media)
      .where(eq(media.id, target.id))
    expect(replaced.key).not.toBe(KEYS[0])
    expect(result).toEqual({
      moved: 3,
      failed: [],
      remaining: 0,
      configured: true,
    })
    expect(r2.objects.has(KEYS[0])).toBe(false)
    expect([...r2.objects.keys()].sort()).toEqual(
      [KEYS[1], KEYS[2], replaced.key].sort()
    )
    expect(replaced.driver).toBe("r2")
    expect(await defaultDisk.read(replaced.key)).toBeNull()
  })

  it("a row deleted mid-copy: the copy is removed, nothing fails", async () => {
    const r2 = hookedR2(KEYS[0], async () => {
      await getDb().delete(media).where(eq(media.key, KEYS[0]))
    })
    const result = await migrateDiskMediaToR2({
      deadline: Date.now() + 30_000,
      r2,
      disk,
    })
    expect(result).toEqual({
      moved: 2,
      failed: [],
      remaining: 0,
      configured: true,
    })
    expect(r2.objects.has(KEYS[0])).toBe(false)
  })

  it("a row already switched to r2 with the same key keeps the copy", async () => {
    const r2 = hookedR2(KEYS[0], async () => {
      await getDb()
        .update(media)
        .set({ driver: "r2" })
        .where(eq(media.key, KEYS[0]))
    })
    const result = await migrateDiskMediaToR2({
      deadline: Date.now() + 30_000,
      r2,
      disk,
    })
    expect(result).toEqual({
      moved: 2,
      failed: [],
      remaining: 0,
      configured: true,
    })
    expect(r2.objects.has(KEYS[0])).toBe(true)
    expect((await drivers())[KEYS[0]]).toBe("r2")
  })

  it("stops when the R2 settings change mid-copy: row stays on disk, copy removed, nothing lost", async () => {
    await saveR2((await signedInUser(["owner"])).cookie)
    const r2 = hookedR2(KEYS[0], async () => {
      await getDb().delete(settings).where(eq(settings.key, "integrations.r2"))
    })
    const result = await migrateDiskMediaToR2({
      deadline: Date.now() + 30_000,
      r2,
      disk,
    })
    expect(result).toEqual({
      moved: 0,
      failed: [
        "The R2 settings changed during the move; it continues on the next run.",
      ],
      remaining: 3,
      configured: true,
      settingsChanged: true,
    })
    expect(r2.objects.size).toBe(0)
    for (const key of KEYS) {
      expect((await drivers())[key]).toBe("disk")
      expect(await disk.read(key)).not.toBeNull()
    }
  })

  it("records fixed messages for disk problems (no server paths)", async () => {
    await rm(join(root, KEYS[0]))
    const failingDisk: StorageDriver = {
      ...disk,
      async read(key) {
        if (key === KEYS[1])
          throw new Error(
            `EACCES: permission denied, open '${join(root, key)}'`
          )
        return disk.read(key)
      },
    }
    const result = await migrateDiskMediaToR2({
      deadline: Date.now() + 30_000,
      r2: memoryR2(),
      disk: failingDisk,
    })
    expect(result.failed).toEqual([
      `${KEYS[0]}: file missing on the server disk`,
      `${KEYS[1]}: could not read the file on the server disk`,
    ])
    expect(result).toMatchObject({ moved: 1, remaining: 2 })
    expect(result.failed.join(" ")).not.toContain(root)
  })

  it("a re-run after a crash between copy and switch puts the same key again", async () => {
    const r2 = memoryR2()
    await r2.put(KEYS[0], new Uint8Array([7, 7]), "image/png") // copied, never switched
    expect(
      await migrateDiskMediaToR2({ deadline: Date.now() + 30_000, r2, disk })
    ).toMatchObject({
      moved: 3,
      remaining: 0,
    })
    expect([...(r2.objects.get(KEYS[0]) ?? [])]).toEqual([1, 2, 3])
  })
})

describe("triggered jobs in the scheduler", () => {
  it("are never created by ensureRecurringJobs", async () => {
    await ensureRecurringJobs(new Date())
    expect(
      await getDb()
        .select()
        .from(jobs)
        .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
    ).toEqual([])
  })

  it("tick() dispatches the real job by default; without R2 it ends and deletes its row", async () => {
    await enqueueKeyedJob(getDb(), { ...MIGRATE_MEDIA_JOB, runAt: new Date() })
    const results = await tick({
      now: new Date(),
      revalidate: async () => undefined,
    })
    expect(
      results.find((r) => r.name === MIGRATE_MEDIA_JOB.name)
    ).toMatchObject({
      ok: true,
      error: "R2 is not configured any more; nothing was moved.",
    })
    expect(
      await getDb()
        .select()
        .from(jobs)
        .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
    ).toEqual([])
    expect(
      Object.values(await drivers()).filter((d) => d === "disk")
    ).toHaveLength(3)
  })

  it("a run that is not done stays queued for the next tick with its warning", async () => {
    const now = new Date()
    await enqueueKeyedJob(getDb(), { ...MIGRATE_MEDIA_JOB, runAt: now })
    const job = {
      ...MIGRATE_MEDIA_JOB,
      everyMs: 0,
      run: async () => ({ done: false, warning: "Not moved: x" }),
    }
    await tick({ now, jobs: [job], revalidate: async () => undefined })
    const [row] = await getDb()
      .select()
      .from(jobs)
      .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
    expect(row).toMatchObject({ lockedAt: null, lastError: "Not moved: x" })
    expect(row.runAt.getTime()).toBe(now.getTime())
  })

  it("a failed run keeps its row (retried), even if it claimed done", async () => {
    const now = new Date()
    await enqueueKeyedJob(getDb(), { ...MIGRATE_MEDIA_JOB, runAt: now })
    const job = {
      ...MIGRATE_MEDIA_JOB,
      everyMs: 0,
      run: async (): Promise<{ done: boolean }> => {
        throw new Error("boom")
      },
    }
    await tick({ now, jobs: [job], revalidate: async () => undefined })
    const [row] = await getDb()
      .select()
      .from(jobs)
      .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
    expect(row.lastError).toBe("boom")
    expect(row.runAt.getTime()).toBe(now.getTime() + RETRY_DELAY_MS)
  })

  it("POST while a run holds the job leaves it alone; the start is audited", async () => {
    const owner = (await signedInUser(["owner"])).cookie
    await adminRequest("/integrations/integrations.r2", {
      cookie: owner,
      method: "PUT",
      json: {
        version: 0,
        values: {
          accountId: "0123456789abcdef0123456789abcdef",
          jurisdiction: "default",
          bucket: "sp-media",
          accessKeyId: "AKID",
          secretAccessKey: "SECRET",
        },
      },
    })
    const runAt = new Date("2026-01-01T00:00:00.000Z")
    await getDb()
      .insert(jobs)
      .values({ ...MIGRATE_MEDIA_JOB, runAt, lockedAt: new Date() })
    const res = await adminRequest(
      "/integrations/integrations.r2/migrate-media",
      { cookie: owner, method: "POST" }
    )
    expect(res.status).toBe(202)
    expect(((await res.json()) as MediaMigrationStatus).state).toBe("running")
    const [row] = await getDb()
      .select()
      .from(jobs)
      .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
    expect(row.runAt.toISOString()).toBe(runAt.toISOString())
    const audits = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "media.migration_started"))
    // The no-op (row held by a run) writes no audit.
    expect(audits).toEqual([])

    await getDb()
      .update(jobs)
      .set({ lockedAt: null })
      .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
    const again = await adminRequest(
      "/integrations/integrations.r2/migrate-media",
      {
        cookie: owner,
        method: "POST",
      }
    )
    expect(((await again.json()) as MediaMigrationStatus).state).toBe("queued")
    const started = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "media.migration_started"))
    expect(started).toHaveLength(1)
    expect(started[0].diff).toEqual({ onDisk: 3 })
  })

  it("a poison file parks the job (no endless retries); status says stopped; POST re-queues", async () => {
    const owner = (await signedInUser(["owner"])).cookie
    await adminRequest("/integrations/integrations.r2", {
      cookie: owner,
      method: "PUT",
      json: {
        version: 0,
        values: {
          accountId: "0123456789abcdef0123456789abcdef",
          jurisdiction: "default",
          bucket: "sp-media",
          accessKeyId: "AKID",
          secretAccessKey: "SECRET",
        },
      },
    })
    const r2 = memoryR2([KEYS[1]])
    const job = {
      ...migrateMediaJob,
      run: async () =>
        migrationOutcome(
          await migrateDiskMediaToR2({
            deadline: Date.now() + 30_000,
            r2,
            disk,
          })
        ),
    }
    const row = async () =>
      (
        await getDb()
          .select()
          .from(jobs)
          .where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))
      )[0]
    const t0 = new Date()
    await enqueueKeyedJob(getDb(), { ...MIGRATE_MEDIA_JOB, runAt: t0 })

    // Run 1 makes progress (2 moved, 1 failed): queued again for the next tick.
    await tick({ now: t0, jobs: [job], revalidate: async () => undefined })
    expect((await row()).runAt.getTime()).toBe(t0.getTime())
    expect((await row()).payload).toBeNull()

    // Run 2 moves nothing: parked, not due again.
    const t1 = new Date(t0.getTime() + 60_000)
    await tick({ now: t1, jobs: [job], revalidate: async () => undefined })
    const parked = await row()
    expect(parked.runAt.toISOString()).toBe(PARKED_RUN_AT.toISOString())
    expect(parked.payload).toEqual({
      parked: { failed: [`${KEYS[1]}: R2 put failed`] },
    })
    expect(parked.lastError).toBe(`Not moved: ${KEYS[1]}: R2 put failed`)
    const t2 = new Date(t1.getTime() + 60_000)
    expect(
      await tick({ now: t2, jobs: [job], revalidate: async () => undefined })
    ).toEqual([])

    const status = await adminRequest(
      "/integrations/integrations.r2/migrate-media",
      { cookie: owner }
    )
    expect(await status.json()).toMatchObject({
      state: "stopped",
      onDisk: 1,
      inR2: 2,
      failed: [`${KEYS[1]}: R2 put failed`],
    })

    const res = await adminRequest(
      "/integrations/integrations.r2/migrate-media",
      {
        cookie: owner,
        method: "POST",
      }
    )
    expect(res.status).toBe(202)
    expect(await res.json()).toMatchObject({
      state: "queued",
      failed: [],
      lastError: null,
    })
    const requeued = await row()
    expect(requeued.payload).toBeNull()
    expect(requeued.runAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it("saved R2 settings that cannot be decrypted are reported, not hidden as 'not set up'", async () => {
    const owner = (await signedInUser(["owner"])).cookie
    await adminRequest("/integrations/integrations.r2", {
      cookie: owner,
      method: "PUT",
      json: {
        version: 0,
        values: {
          accountId: "0123456789abcdef0123456789abcdef",
          jurisdiction: "default",
          bucket: "sp-media",
          accessKeyId: "AKID",
          secretAccessKey: "SECRET",
        },
      },
    })
    await getDb()
      .update(settings)
      .set({
        draft: sql`jsonb_set(${settings.draft}, '{secretAccessKey}', '"v1:AAAA:AAAA:AAAA"')`,
      })
      .where(eq(settings.key, "integrations.r2"))
    const message = "The saved R2 settings can't be read. Save them again."
    const status = await adminRequest(
      "/integrations/integrations.r2/migrate-media",
      { cookie: owner }
    )
    expect(await status.json()).toMatchObject({
      r2Configured: false,
      r2Error: message,
    })
    const start = await adminRequest(
      "/integrations/integrations.r2/migrate-media",
      {
        cookie: owner,
        method: "POST",
      }
    )
    expect(start.status).toBe(422)
    expect(
      ((await start.json()) as { error: { message: string } }).error.message
    ).toBe(message)
  })
})
