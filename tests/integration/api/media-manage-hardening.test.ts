import { existsSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { resolve } from "node:path"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { and, eq, isNotNull, sql } from "drizzle-orm"
import sharp from "sharp"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { MediaItem, MediaUsage } from "@/lib/schemas/api/media"
import { app } from "@/server/api/app"
import { type DbOrTx, getDb } from "@/server/db/client"
import {
  auditLog,
  clients,
  groupCompanies,
  media,
  mediaUsages,
  services,
  settings,
  teamMembers,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import type { Actor } from "@/server/lib/actor"
import { resetR2Client } from "@/server/lib/r2-client"
import { AppError } from "@/server/lib/errors"
import { syncMediaUsages } from "@/server/lib/media-usages"
import { defaultUploadsRoot, diskStorage } from "@/server/lib/storage"
import {
  deleteIntegration,
  saveIntegration,
} from "@/server/modules/integrations/service"
import {
  deleteMediaRow,
  lockMediaRow,
  replaceMediaUsages,
} from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, createUser, ORIGIN, signedInUser } from "../helpers/auth"

let editor: string
let author: string
let owner: Actor
const created: string[] = []

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  author = (await signedInUser(["author"])).cookie
  const user = await createUser({ roles: ["owner"] })
  owner = {
    userId: user.id,
    roles: ["owner"],
    ip: null,
    userAgent: null,
    impersonatorId: null,
  }
})
beforeEach(() => revalidateTag.mockClear())
afterAll(async () => {
  for (const key of created) await diskStorage().delete(key)
})

const keyOf = (item: { url: string }) =>
  item.url.replace("/api/v1/media/file/", "")

async function send(path: string, bytes: Uint8Array, name: string) {
  const form = new FormData()
  form.append("file", new File([new Uint8Array(bytes)], name))
  const res = await app.request(`/api/v1/admin/media${path}`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie: editor },
    body: form,
  })
  const body = (await res.json()) as MediaItem & {
    error?: { code: string; message: string }
  }
  if (res.ok && body.driver === "disk") created.push(keyOf(body))
  return { status: res.status, body }
}

const png = (color = "#0d1b36") =>
  sharp({ create: { width: 8, height: 4, channels: 3, background: color } })
    .png()
    .toBuffer()

const rowOf = async (id: string) =>
  (await getDb().select().from(media).where(eq(media.id, id)))[0]

const auditActions = async (id: string) =>
  (
    await getDb()
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, id))
  ).map((a) => a.action)

describe("PATCH alt text", () => {
  it("strips control, zero-width and bidi characters and audits the change", async () => {
    const { body } = await send("/upload", await png(), "a.png")
    const res = await adminRequest(`/media/${body.id}`, {
      cookie: editor,
      method: "PATCH",
      json: { alt: "  Guard\u0007 at\u200b the \u202egate\u2066 " },
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as MediaItem).alt).toBe("Guard at the gate")
    expect(await auditActions(body.id)).toEqual([
      "media.uploaded",
      "media.updated",
    ])
  })

  it("caps alt text at 500 characters and answers 404 for unknown ids", async () => {
    const { body } = await send("/upload", await png(), "b.png")
    const long = await adminRequest(`/media/${body.id}`, {
      cookie: editor,
      method: "PATCH",
      json: { alt: "x".repeat(501) },
    })
    expect(long.status).toBe(422)
    const missing = "01900000-0000-7000-8000-000000000000"
    expect(
      (
        await adminRequest(`/media/${missing}`, {
          cookie: editor,
          method: "PATCH",
          json: { alt: "x" },
        })
      ).status
    ).toBe(404)
    expect(
      (await adminRequest(`/media/${missing}/usages`, { cookie: editor }))
        .status
    ).toBe(404)
  })
})

describe("DELETE guards", () => {
  it("answers 409 from the RESTRICT FK when a team photo has no usage row", async () => {
    const [member] = await getDb()
      .select()
      .from(teamMembers)
      .where(isNotNull(teamMembers.photoId))
      .limit(1)
    const photoId = member.photoId!
    await getDb().delete(mediaUsages).where(eq(mediaUsages.mediaId, photoId))
    const res = await adminRequest(`/media/${photoId}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(res.status).toBe(409)
    const { error } = (await res.json()) as {
      error: { code: string; current: { usages: MediaUsage[] } }
    }
    expect(error.code).toBe("CONFLICT")
    expect(error.current.usages).toEqual([])
    expect(await rowOf(photoId)).toBeDefined()
  })

  it("deletes an unused static row and leaves its public/ file alone", async () => {
    // Every seeded file is used: take one referenced only from JSON (no FK
    // column) and drop its usage rows, as if the editors had chosen others.
    const fkUsed = new Set<string | null>(
      [
        ...(await getDb()
          .select({ id: teamMembers.photoId })
          .from(teamMembers)),
        ...(await getDb().select({ id: clients.logoId }).from(clients)),
        ...(await getDb()
          .select({ id: groupCompanies.logoId })
          .from(groupCompanies)),
      ].map((r) => r.id)
    )
    const statics = await getDb()
      .select()
      .from(media)
      .where(eq(media.driver, "static"))
    const row = statics.find(
      // hero.jpg is replaced below
      (m) => !fkUsed.has(m.id) && m.key !== "/images/hero.jpg"
    )
    if (!row) throw new Error("seed has no JSON-only static file")
    await getDb().delete(mediaUsages).where(eq(mediaUsages.mediaId, row.id))
    const file = resolve(process.cwd(), "public", row.key.slice(1))
    expect(existsSync(file)).toBe(true)
    const res = await adminRequest(`/media/${row.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(res.status).toBe(200)
    expect(await rowOf(row.id)).toBeUndefined()
    expect(existsSync(file)).toBe(true)
  })
})

describe("replace runs the upload pipeline", () => {
  it("sanitises a replacement SVG and audits media.replaced", async () => {
    const { body: first } = await send(
      "/upload",
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'
      ),
      "icon.svg"
    )
    const { status, body } = await send(
      `/${first.id}/replace`,
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="6" height="6"><script>alert(1)</script><rect width="2" height="2" onload="x()"/></svg>'
      ),
      "icon-2.svg"
    )
    expect(status).toBe(200)
    expect(body).toMatchObject({ id: first.id, mime: "image/svg+xml" })
    const served = await (await app.request(body.url)).text()
    expect(served).not.toMatch(/script|onload/)
    expect(await auditActions(first.id)).toEqual([
      "media.uploaded",
      "media.replaced",
    ])
  })

  it("answers 404 for an unknown id", async () => {
    const res = await send(
      "/01900000-0000-7000-8000-000000000000/replace",
      await png(),
      "x.png"
    )
    expect(res.status).toBe(404)
  })

  it("replaces a static row with an uploaded file; public/ stays", async () => {
    const [hero] = await getDb()
      .select()
      .from(media)
      .where(eq(media.key, "/images/hero.jpg"))
    const jpeg = await sharp({
      create: { width: 12, height: 6, channels: 3, background: "#123" },
    })
      .jpeg()
      .toBuffer()
    const { status, body } = await send(`/${hero.id}/replace`, jpeg, "hero.jpg")
    expect(status).toBe(200)
    expect(body).toMatchObject({ id: hero.id, driver: "disk", width: 12 })
    expect(existsSync(resolve(process.cwd(), "public/images/hero.jpg"))).toBe(
      true
    )
    // Usages still point at the same id.
    const usages = await getDb()
      .select({ id: mediaUsages.id })
      .from(mediaUsages)
      .where(
        and(eq(mediaUsages.mediaId, hero.id), eq(mediaUsages.entityId, "home"))
      )
    expect(usages.length).toBeGreaterThan(0)
  })

  it("two concurrent replaces leave exactly one stored file", async () => {
    const { body: first } = await send("/upload", await png(), "c.png")
    // Hold the row lock until both replaces have stored their file and wait
    // for the row, so their transactions really overlap.
    let release: (() => void) | undefined
    const held = getDb().transaction(async (tx) => {
      await lockMediaRow(tx, first.id)
      await new Promise<void>((resolve) => (release = resolve))
    })
    await vi.waitFor(() => expect(release).toBeDefined())
    const pending = Promise.all([
      send(`/${first.id}/replace`, await png("#111"), "c1.png"),
      send(`/${first.id}/replace`, await png("#222"), "c2.png"),
    ])
    await vi.waitFor(
      async () => {
        const { rows } = await getDb().execute<{ n: number }>(
          sql`select count(*)::int as n from pg_stat_activity
              where datname = current_database() and wait_event_type = 'Lock'`
        )
        expect(rows[0].n).toBe(2)
      },
      { timeout: 10_000, interval: 50 }
    )
    release!()
    await held
    const [a, b] = await pending
    expect([a.status, b.status]).toEqual([200, 200])
    const final = await rowOf(first.id)
    const disk = diskStorage()
    expect(await disk.read(final.key)).not.toBeNull()
    for (const key of [keyOf(first), keyOf(a.body), keyOf(b.body)])
      if (key !== final.key) expect(await disk.read(key), key).toBeNull()
  })
})

/** Waits until `n` backends of the test DB are blocked on a row lock. */
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

/** Runs `body` in a transaction that stays open until the returned release() is called. */
async function heldTransaction(
  body: (tx: DbOrTx) => Promise<void>,
  after?: (tx: DbOrTx) => Promise<void>
) {
  let release: (() => void) | undefined
  const done = getDb().transaction(async (tx) => {
    await body(tx)
    await new Promise<void>((resolve) => (release = resolve))
    await after?.(tx)
  })
  await vi.waitFor(() => expect(release).toBeDefined())
  return async () => {
    release!()
    await done
  }
}

describe("usage labels follow the reader's permissions", () => {
  it("authors see that a service uses the file, not its draft title or link", async () => {
    const [usage] = await getDb()
      .select({ mediaId: mediaUsages.mediaId, serviceId: mediaUsages.entityId })
      .from(mediaUsages)
      .where(eq(mediaUsages.entityType, "service"))
      .limit(1)
    const [service] = await getDb()
      .select({ draft: services.draft })
      .from(services)
      .where(eq(services.id, usage.serviceId))
    const title = (service.draft as { title: string }).title
    const list = async (cookie: string) =>
      (
        (await (
          await adminRequest(`/media/${usage.mediaId}/usages`, { cookie })
        ).json()) as { items: MediaUsage[] }
      ).items.filter((u) => u.entityType === "service")

    expect(await list(editor)).toContainEqual(
      expect.objectContaining({
        entityId: usage.serviceId,
        label: `Service: ${title}`,
        href: `/admin/services/${usage.serviceId}`,
      })
    )
    const forAuthor = await list(author)
    expect(forAuthor).toContainEqual(
      expect.objectContaining({
        entityId: usage.serviceId,
        label: "A service",
        href: null,
      })
    )
    expect(JSON.stringify(forAuthor)).not.toContain(title)
  })
})

describe("races (409 or 422, never 500)", () => {
  it("a delete racing a usage insert waits for it and answers 409", async () => {
    const { body } = await send("/upload", await png(), "race.png")
    // A save inserting a usage row, still open (holds FOR KEY SHARE on the media row).
    const commit = await heldTransaction((tx) =>
      replaceMediaUsages(tx, "page", "race-test", [
        { mediaId: body.id, field: "hero.image" },
      ])
    )
    const pending = adminRequest(`/media/${body.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    await lockWaiters(1)
    await commit()
    const res = await pending
    expect(res.status).toBe(409)
    expect(await rowOf(body.id)).toBeDefined()
    await getDb()
      .delete(mediaUsages)
      .where(eq(mediaUsages.entityId, "race-test"))
  })

  it("a usage insert racing a delete answers 422", async () => {
    const { body } = await send("/upload", await png(), "race2.png")
    // A delete in progress: row locked, then removed on release.
    const commit = await heldTransaction(
      async (tx) => {
        await lockMediaRow(tx, body.id)
      },
      async (tx) => {
        await deleteMediaRow(tx, body.id)
      }
    )
    const saving = getDb().transaction((tx) =>
      syncMediaUsages(tx, "page", "race-test-2", {
        hero: { image: { mediaId: body.id } },
      })
    )
    const outcome = saving.then(
      () => null,
      (err: unknown) => err
    )
    await lockWaiters(1)
    await commit()
    const err = await outcome
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(422)
  })

  it("a replace racing a delete answers 404 and removes its new file", async () => {
    const { body } = await send("/upload", await png(), "gone.png")
    const dir = resolve(
      defaultUploadsRoot(),
      ...keyOf(body).split("/").slice(0, 2)
    )
    const commit = await heldTransaction(
      async (tx) => {
        await lockMediaRow(tx, body.id)
      },
      async (tx) => {
        await deleteMediaRow(tx, body.id)
      }
    )
    const before = (await readdir(dir)).sort()
    const pending = send(`/${body.id}/replace`, await png("#555"), "new.png")
    await lockWaiters(1)
    // The replacement is stored before the row lock is taken.
    expect((await readdir(dir)).length).toBe(before.length + 1)
    await commit()
    const res = await pending
    expect(res.status).toBe(404)
    expect((await readdir(dir)).sort()).toEqual(before)
    expect(await rowOf(body.id)).toBeUndefined()
  })
})

const R2_VALUES = {
  accountId: "0123456789abcdef0123456789abcdef",
  jurisdiction: "default",
  bucket: "sp-media",
  accessKeyId: "AKIDEXAMPLE1234",
  secretAccessKey: "SECRETEXAMPLE1234",
}

describe("replace to R2 (same guard as upload)", () => {
  const objects = new Map<string, Uint8Array>()
  let onPut: (() => Promise<void>) | null = null
  let r2Version = 0

  beforeEach(async () => {
    objects.clear()
    onPut = null
    await getDb().delete(media).where(eq(media.driver, "r2"))
    await getDb().delete(settings).where(eq(settings.key, "integrations.r2"))
    r2Version = (
      await saveIntegration(owner, "integrations.r2", {
        version: 0,
        values: R2_VALUES,
      })
    ).version
    vi.spyOn(S3Client.prototype, "send").mockImplementation((async (
      command: unknown
    ) => {
      if (command instanceof PutObjectCommand) {
        await onPut?.()
        objects.set(command.input.Key!, command.input.Body as Uint8Array)
        return {}
      }
      if (command instanceof GetObjectCommand) {
        const bytes = objects.get(command.input.Key!)
        if (!bytes) throw new NoSuchKey({ message: "missing", $metadata: {} })
        return { Body: { transformToByteArray: async () => bytes } }
      }
      if (command instanceof DeleteObjectCommand) {
        objects.delete(command.input.Key!)
        return {}
      }
      return {}
    }) as never)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    resetR2Client()
    await getDb().delete(settings).where(eq(settings.key, "integrations.r2"))
  })

  async function diskUpload() {
    // Uploaded while R2 is not configured, so it lands on disk.
    await getDb().delete(settings).where(eq(settings.key, "integrations.r2"))
    const { body } = await send("/upload", await png(), "d.png")
    r2Version = (
      await saveIntegration(owner, "integrations.r2", {
        version: 0,
        values: R2_VALUES,
      })
    ).version
    return body
  }

  it("moves a disk file to R2 and deletes the disk file after the commit", async () => {
    const first = await diskUpload()
    expect(first.driver).toBe("disk")
    const { status, body } = await send(
      `/${first.id}/replace`,
      await png("#333"),
      "r2.png"
    )
    expect(status).toBe(200)
    expect(body.driver).toBe("r2")
    expect(objects.has(keyOf(body))).toBe(true)
    expect(await diskStorage().read(keyOf(first))).toBeNull()
    expect(revalidateTag).toHaveBeenCalledWith(`media:${first.id}`, {
      expire: 0,
    })
  })

  it("refuses (409) when R2 is disconnected mid-put: new object removed, row and old file kept", async () => {
    const first = await diskUpload()
    onPut = async () => {
      await deleteIntegration(owner, "integrations.r2", r2Version)
    }
    const { status, body } = await send(
      `/${first.id}/replace`,
      await png("#444"),
      "late.png"
    )
    expect(status).toBe(409)
    expect(body.error?.message).toMatch(/storage settings changed/i)
    expect(objects.size).toBe(0)
    const row = await rowOf(first.id)
    expect(row).toMatchObject({ key: keyOf(first), driver: "disk" })
    expect(await diskStorage().read(keyOf(first))).not.toBeNull()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
