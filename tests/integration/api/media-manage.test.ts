import { eq } from "drizzle-orm"
import sharp from "sharp"
import {
  afterAll,
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
import { getDb } from "@/server/db/client"
import { auditLog, media } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { diskStorage } from "@/server/lib/storage"

import { resetDb } from "../db"
import { adminRequest, ORIGIN, signedInUser } from "../helpers/auth"

let editor: string
let author: string
const created: string[] = []

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  author = (await signedInUser(["author"])).cookie
})
beforeEach(() => revalidateTag.mockClear())
afterAll(async () => {
  for (const key of created) await diskStorage().delete(key)
})

const keyOf = (item: MediaItem) => item.url.replace("/api/v1/media/file/", "")

async function send(path: string, cookie: string, bytes: Buffer, name: string) {
  const form = new FormData()
  form.append("file", new File([new Uint8Array(bytes)], name))
  const res = await app.request(`/api/v1/admin/media${path}`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie },
    body: form,
  })
  const body = (await res.json()) as MediaItem
  if (res.ok) created.push(keyOf(body))
  return { status: res.status, body }
}
const png = (color = "#0d1b36") =>
  sharp({ create: { width: 32, height: 16, channels: 3, background: color } })
    .png()
    .toBuffer()

const heroId = async () =>
  (
    await getDb()
      .select({ id: media.id })
      .from(media)
      .where(eq(media.key, "/images/hero.jpg"))
  )[0].id

describe("PATCH /api/v1/admin/media/:id", () => {
  it("updates alt text and focal point; expires media:<id>", async () => {
    const id = await heroId()
    const res = await adminRequest(`/media/${id}`, {
      cookie: editor,
      method: "PATCH",
      json: { alt: "Patrol car at night", focal: { x: 0.25, y: 0.6 } },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      alt: "Patrol car at night",
      focalX: 0.25,
      focalY: 0.6,
    })
    expect(revalidateTag).toHaveBeenCalledWith(`media:${id}`, { expire: 0 })

    const reset = await adminRequest(`/media/${id}`, {
      cookie: editor,
      method: "PATCH",
      json: { focal: null },
    })
    expect(await reset.json()).toMatchObject({ focalX: null, focalY: null })
  })

  it("validates input and needs media:update", async () => {
    const id = await heroId()
    expect(
      (
        await adminRequest(`/media/${id}`, {
          cookie: editor,
          method: "PATCH",
          json: { focal: { x: 1.5, y: 0 } },
        })
      ).status
    ).toBe(422)
    expect(
      (
        await adminRequest(`/media/${id}`, {
          cookie: editor,
          method: "PATCH",
          json: {},
        })
      ).status
    ).toBe(422)
    expect(
      (
        await adminRequest(`/media/${id}`, {
          cookie: author,
          method: "PATCH",
          json: { alt: "x" },
        })
      ).status
    ).toBe(403)
  })
})

describe("usages and DELETE (media_usages RESTRICT → 409)", () => {
  it("lists where a file is used, with labels and links", async () => {
    const res = await adminRequest(`/media/${await heroId()}/usages`, {
      cookie: author,
    })
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as { items: MediaUsage[] }
    expect(items).toContainEqual({
      entityType: "page",
      entityId: "home",
      field: "hero.backgroundImage",
      label: "Home page",
      href: "/admin/pages/home",
    })
  })

  it("refuses to delete a file in use and names the places", async () => {
    const res = await adminRequest(`/media/${await heroId()}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(res.status).toBe(409)
    const { error } = (await res.json()) as {
      error: { code: string; current: { usages: MediaUsage[] } }
    }
    expect(error.code).toBe("CONFLICT")
    expect(error.current.usages.map((u) => u.label)).toContain("Home page")
  })

  it("deletes an unused upload, its file and audits it", async () => {
    const { body } = await send("/upload", editor, await png(), "spare.png")
    const res = await adminRequest(`/media/${body.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(res.status).toBe(200)
    expect(await diskStorage().read(keyOf(body))).toBeNull()
    expect(
      await getDb().select().from(media).where(eq(media.id, body.id))
    ).toEqual([])
    const audit = await getDb()
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, body.id))
    expect(audit.map((a) => a.action)).toEqual([
      "media.uploaded",
      "media.deleted",
    ])
    expect(revalidateTag).toHaveBeenCalledWith(`media:${body.id}`, {
      expire: 0,
    })
    expect(
      (
        await adminRequest(`/media/${body.id}`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(404)
  })

  it("authors cannot delete", async () => {
    const { body } = await send("/upload", author, await png(), "mine.png")
    expect(
      (
        await adminRequest(`/media/${body.id}`, {
          cookie: author,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
  })
})

describe("POST /api/v1/admin/media/:id/replace", () => {
  it("keeps the id, writes a new file and removes the old one", async () => {
    const { body: first } = await send(
      "/upload",
      editor,
      await png(),
      "logo-old.png"
    )
    const jpeg = await sharp({
      create: { width: 20, height: 10, channels: 3, background: "#fff" },
    })
      .jpeg()
      .toBuffer()
    const { status, body } = await send(
      `/${first.id}/replace`,
      editor,
      jpeg,
      "logo-new.jpg"
    )
    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: first.id,
      mime: "image/jpeg",
      width: 20,
      height: 10,
      originalName: "logo-new.jpg",
    })
    expect(body.url).not.toBe(first.url)
    expect(await diskStorage().read(keyOf(first))).toBeNull()
    expect((await app.request(body.url)).status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith(`media:${first.id}`, {
      expire: 0,
    })
  })

  it("only replaces an image with an image", async () => {
    const { body } = await send("/upload", editor, await png(), "photo.png")
    const pdf = Buffer.from("%PDF-1.4\n%%EOF\n")
    const res = await send(`/${body.id}/replace`, editor, pdf, "doc.pdf")
    expect(res.status).toBe(422)
    expect(
      (await send(`/${body.id}/replace`, author, await png("#fff"), "x.png"))
        .status
    ).toBe(403)
  })
})
