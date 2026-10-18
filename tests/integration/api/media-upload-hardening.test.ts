import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { and, eq } from "drizzle-orm"
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

import type { MediaItem } from "@/lib/schemas/api/media"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { media, settings } from "@/server/db/schema"
import type { Actor } from "@/server/lib/actor"
import { resetR2Client } from "@/server/lib/r2-client"
import { diskStorage } from "@/server/lib/storage"
import {
  deleteIntegration,
  saveIntegration,
} from "@/server/modules/integrations/service"
import { insertMediaRow, lockR2Settings } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { createUser, ORIGIN, signedInUser } from "../helpers/auth"

let editor: string
let owner: Actor
const created: string[] = []

beforeAll(async () => {
  await resetDb()
  editor = (await signedInUser(["editor"])).cookie
  const user = await createUser({ roles: ["owner"] })
  owner = {
    userId: user.id,
    roles: ["owner"],
    ip: null,
    userAgent: null,
    impersonatorId: null,
  }
})

afterAll(async () => {
  const disk = diskStorage()
  for (const key of created) await disk.delete(key)
})

async function upload(
  file: { bytes: Uint8Array | Buffer; name: string; type: string },
  cookie = editor
) {
  const form = new FormData()
  form.append(
    "file",
    new File([new Uint8Array(file.bytes)], file.name, { type: file.type })
  )
  const res = await app.request("/api/v1/admin/media/upload", {
    method: "POST",
    headers: { origin: ORIGIN, cookie },
    body: form,
  })
  const body = (await res.json()) as MediaItem & {
    error?: { code: string; message: string }
  }
  if (res.status === 201 && body.driver === "disk")
    created.push(body.url.replace("/api/v1/media/file/", ""))
  return { status: res.status, body }
}

const png = () =>
  sharp({ create: { width: 6, height: 4, channels: 3, background: "#0d1b36" } })
    .png()
    .toBuffer()

describe("file route hardening", () => {
  it("serves only keys with a media row (orphans, temp files, healthchecks are 404)", async () => {
    const disk = diskStorage()
    for (const key of [
      "2026/10/orphan.png",
      "healthcheck-x.txt",
      "2026/10/a.png.tmp",
    ]) {
      await disk.put(key, await png(), "image/png")
      created.push(key)
      expect((await app.request(`/api/v1/media/file/${key}`)).status, key).toBe(
        404
      )
    }
  })

  it("sends nosniff and no disposition for raster images", async () => {
    const { body } = await upload({
      bytes: await png(),
      name: "a.png",
      type: "image/png",
    })
    const file = await app.request(body.url)
    expect(file.status).toBe(200)
    expect(file.headers.get("x-content-type-options")).toBe("nosniff")
    expect(file.headers.get("content-disposition")).toBeNull()
    expect(file.headers.get("content-security-policy")).toBeNull()
  })

  it("decodes the raw path exactly once", async () => {
    const { body } = await upload({
      bytes: await png(),
      name: "a.png",
      type: "image/png",
    })
    // The catch-all hands Hono the raw URL: encoded unreserved characters
    // still name the same (valid) key...
    const encoded = body.url
      .replace(/\.png$/, "%2Epng")
      .replace("/file/2", "/file/%32")
    expect((await app.request(encoded)).status).toBe(200)
    // ...and a double-encoded one is not decoded twice.
    expect(
      (await app.request(body.url.replace(/\.png$/, "%252Epng"))).status
    ).toBe(404)
  })

  it("serves SVG with its own type, sandboxed, whatever the upload claimed", async () => {
    const { body } = await upload({
      bytes: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'
      ),
      name: "x.svg",
      type: "text/html",
    })
    const file = await app.request(body.url)
    expect(file.headers.get("content-type")).toBe("image/svg+xml")
    expect(file.headers.get("content-security-policy")).toMatch(
      /^default-src 'none'.*; sandbox$/
    )
    expect(file.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("publishes photos without EXIF/GPS, upright, with their ICC profile", async () => {
    const photo = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#336699" },
    })
      .jpeg()
      .withExif({
        IFD0: { Make: "PhoneCo" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "53/1 20/1 0/1" },
      })
      .withMetadata({ orientation: 6 })
      .withIccProfile("p3")
      .toBuffer()
    expect((await sharp(photo).metadata()).exif).toBeDefined()

    const { status, body } = await upload({
      bytes: photo,
      name: "IMG_0001.jpg",
      type: "image/jpeg",
    })
    expect(status).toBe(201)
    expect(body).toMatchObject({ mime: "image/jpeg", width: 30, height: 40 })
    const served = Buffer.from(
      await (await app.request(body.url)).arrayBuffer()
    )
    expect(served.byteLength).toBe(body.size)
    const meta = await sharp(served).metadata()
    expect(meta.exif).toBeUndefined()
    expect(meta.orientation).toBeUndefined()
    expect(meta.icc).toBeDefined()
    expect(meta).toMatchObject({ width: 30, height: 40 })
    expect(served.includes("PhoneCo")).toBe(false)
  })

  it("never uses the uploaded file name in the key", async () => {
    const { status, body } = await upload({
      bytes: await png(),
      name: "../../evil.png",
      type: "image/png",
    })
    expect(status).toBe(201)
    expect(body.originalName).toBe("evil.png")
    expect(body.url).not.toContain("evil")
  })
})

const R2_VALUES = {
  accountId: "0123456789abcdef0123456789abcdef",
  jurisdiction: "default",
  bucket: "sp-media",
  accessKeyId: "AKIDEXAMPLE1234",
  secretAccessKey: "SECRETEXAMPLE1234",
}

describe("uploads to R2 (Disconnect cannot race them)", () => {
  const objects = new Map<string, Uint8Array>()
  let onPut: (() => Promise<void>) | null = null
  let failDelete = false
  let r2Version = 0

  beforeEach(async () => {
    objects.clear()
    onPut = null
    failDelete = false
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
        if (failDelete) throw new Error("provider detail AKIDEXAMPLE1234")
        objects.delete(command.input.Key!)
        return {}
      }
      return {}
    }) as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetR2Client()
  })

  it("stores in R2 and serves the object through the file route", async () => {
    const bytes = await png()
    const { status, body } = await upload({
      bytes,
      name: "r2.png",
      type: "image/png",
    })
    expect(status).toBe(201)
    expect(body.driver).toBe("r2")
    expect(objects.size).toBe(1)
    const file = await app.request(body.url)
    expect(file.status).toBe(200)
    expect(file.headers.get("content-type")).toBe("image/png")
    const [stored] = [...objects.values()]
    expect(Buffer.from(await file.arrayBuffer()).equals(stored)).toBe(true)
    expect(stored.byteLength).toBe(body.size)
  })

  it("logs only the key when the orphaned object cannot be deleted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    failDelete = true
    onPut = async () => {
      await deleteIntegration(owner, "integrations.r2", r2Version)
    }
    const { status } = await upload({
      bytes: await png(),
      name: "orphan.png",
      type: "image/png",
    })
    expect(status).toBe(409)
    expect(warn).toHaveBeenCalledOnce()
    const [message] = warn.mock.calls[0]
    expect(message).toMatch(
      /^\[media\] could not delete orphaned upload \d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/
    )
    expect(warn.mock.calls[0]).toHaveLength(1)
  })

  it("refuses the row (and deletes the object) when R2 was disconnected mid-upload", async () => {
    onPut = async () => {
      await deleteIntegration(owner, "integrations.r2", r2Version)
    }
    const { status, body } = await upload({
      bytes: await png(),
      name: "late.png",
      type: "image/png",
    })
    expect(status).toBe(409)
    expect(body.error?.message).toMatch(/storage settings changed/i)
    expect(objects.size).toBe(0)
    const rows = await getDb()
      .select({ id: media.id })
      .from(media)
      .where(eq(media.driver, "r2"))
    expect(rows).toEqual([])
  })

  it("refuses the row when the R2 account changed mid-upload", async () => {
    onPut = async () => {
      await saveIntegration(owner, "integrations.r2", {
        version: r2Version,
        values: { ...R2_VALUES, bucket: "sp-other" },
      })
    }
    const { status } = await upload({
      bytes: await png(),
      name: "moved.png",
      type: "image/png",
    })
    expect(status).toBe(409)
    expect(objects.size).toBe(0)
  })

  it("Disconnect waits for an upload holding the settings lock, then sees its row", async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let markLocked!: () => void
    const locked = new Promise<void>((resolve) => (markLocked = resolve))
    const uploadTx = getDb().transaction(async (tx) => {
      expect(await lockR2Settings(tx)).toMatchObject({ version: r2Version })
      await insertMediaRow(tx, {
        key: "2026/10/race.png",
        driver: "r2",
        mime: "image/png",
        size: 1,
      })
      markLocked()
      await gate
    })
    await locked

    let settled = false
    const disconnect = deleteIntegration(owner, "integrations.r2", r2Version)
    disconnect.then(
      () => (settled = true),
      () => (settled = true)
    )
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(settled).toBe(false)

    release()
    await uploadTx
    await expect(disconnect).rejects.toMatchObject({ code: "CONFLICT" })
    const [row] = await getDb()
      .select({ key: settings.key })
      .from(settings)
      .where(and(eq(settings.key, "integrations.r2")))
    expect(row).toBeDefined()
  })
})
