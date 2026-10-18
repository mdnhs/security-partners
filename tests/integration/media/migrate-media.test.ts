import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { MediaMigrationStatus } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import { auditLog, jobs, media, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { ALL_JOBS } from "@/server/lib/jobs"
import { MIGRATE_MEDIA_JOB } from "@/server/lib/jobs/migrate-media"
import { ensureRecurringJobs, tick } from "@/server/lib/scheduler"
import { diskStorage, type StorageDriver } from "@/server/lib/storage"
import { enqueueKeyedJob } from "@/server/modules/jobs/repo"
import { migrateDiskMediaToR2 } from "@/server/modules/media/service"

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

  it("a replace landing mid-copy wins: the copied object is removed and the new file moves later", async () => {
    const NEW_KEY = "2026/10/0190a6e0-0000-7000-8000-000000000009.png"
    await disk.put(NEW_KEY, new Uint8Array([9]), "image/png")
    const r2 = hookedR2(KEYS[0], async () => {
      await getDb()
        .update(media)
        .set({ key: NEW_KEY })
        .where(eq(media.key, KEYS[0]))
    })
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
    expect(r2.objects.has(KEYS[0])).toBe(false)
    expect([...r2.objects.keys()].sort()).toEqual(
      [KEYS[1], KEYS[2], NEW_KEY].sort()
    )
    // The old file belongs to the replace (it deletes it after its commit), not to the migration.
    expect(await disk.read(KEYS[0])).not.toBeNull()
    expect((await drivers())[NEW_KEY]).toBe("r2")
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
    expect(audits).toHaveLength(1)
    expect(audits[0].diff).toEqual({ onDisk: 3 })
  })
})
