import { and, eq } from "drizzle-orm"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { MediaItem } from "@/lib/schemas/api/media"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { auditLog, media } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { diskStorage } from "@/server/lib/storage"

import { resetDb } from "../db"
import { adminRequest, ORIGIN, signedInUser } from "../helpers/auth"

// Ruling (WCAG 1.1.1): whoever uploads a file may describe it. Authors and
// marketers (media:create without media:update) edit alt text and focal
// point of their own uploads; replace and delete stay gated.

type Who = { id: string; cookie: string }
let author: Who
let otherAuthor: Who
let marketer: Who
let viewer: Who
const created: string[] = []

const who = async (role: "author" | "marketer" | "viewer") => {
  const { user, cookie } = await signedInUser([role])
  return { id: user.id, cookie }
}

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  author = await who("author")
  otherAuthor = await who("author")
  marketer = await who("marketer")
  viewer = await who("viewer")
})
afterAll(async () => {
  for (const key of created) await diskStorage().delete(key)
})

const png = () =>
  sharp({
    create: { width: 24, height: 12, channels: 3, background: "#1f6f43" },
  })
    .png()
    .toBuffer()

async function upload(as: Who, alt?: string) {
  const form = new FormData()
  form.append("file", new File([new Uint8Array(await png())], "mine.png"))
  if (alt !== undefined) form.append("alt", alt)
  const res = await app.request("/api/v1/admin/media/upload", {
    method: "POST",
    headers: { origin: ORIGIN, cookie: as.cookie },
    body: form,
  })
  expect(res.status).toBe(201)
  const item = (await res.json()) as MediaItem
  created.push(item.url.replace("/api/v1/media/file/", ""))
  return item
}

const patch = (as: Who, id: string, json: unknown) =>
  adminRequest(`/media/${id}`, { cookie: as.cookie, method: "PATCH", json })

describe("own uploads (media:create without media:update)", () => {
  it("stores the alt text sent with the upload and names the uploader", async () => {
    const item = await upload(author, "Guard at the gate")
    expect(item).toMatchObject({
      alt: "Guard at the gate",
      createdBy: author.id,
    })
  })

  it("an author edits alt text and focal point of their own upload", async () => {
    const item = await upload(author)
    const res = await patch(author, item.id, {
      alt: "Night patrol",
      focal: { x: 0.3, y: 0.7 },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      alt: "Night patrol",
      focalX: 0.3,
      focalY: 0.7,
    })
    const [entry] = await getDb()
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "media.updated"),
          eq(auditLog.entityId, item.id)
        )
      )
    expect(entry?.actorId).toBe(author.id)
  })

  it("so does a marketer", async () => {
    const item = await upload(marketer)
    expect((await patch(marketer, item.id, { alt: "Banner" })).status).toBe(200)
  })

  it("never someone else's file, nor a seeded one", async () => {
    const theirs = await upload(otherAuthor)
    expect((await patch(author, theirs.id, { alt: "x" })).status).toBe(403)
    const [hero] = await getDb()
      .select({ id: media.id })
      .from(media)
      .where(eq(media.key, "/images/hero.jpg"))
    expect((await patch(author, hero!.id, { alt: "x" })).status).toBe(403)
    const unchanged = await getDb()
      .select({ alt: media.alt })
      .from(media)
      .where(eq(media.id, theirs.id))
    expect(unchanged[0]!.alt).toBe("")
  })

  it("replace and delete stay gated, even for their own file", async () => {
    const item = await upload(author)
    const form = new FormData()
    form.append("file", new File([new Uint8Array(await png())], "again.png"))
    const replaced = await app.request(
      `/api/v1/admin/media/${item.id}/replace`,
      {
        method: "POST",
        headers: { origin: ORIGIN, cookie: author.cookie },
        body: form,
      }
    )
    expect(replaced.status).toBe(403)
    expect(
      (
        await adminRequest(`/media/${item.id}`, {
          cookie: author.cookie,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
  })

  it("viewers edit nothing", async () => {
    const item = await upload(author)
    expect((await patch(viewer, item.id, { alt: "x" })).status).toBe(403)
  })
})
