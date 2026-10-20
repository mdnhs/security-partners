import { eq } from "drizzle-orm"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { MediaItem } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import { auditLog, media } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { app } from "@/server/api/app"
import { diskStorage } from "@/server/lib/storage"

import { resetDb } from "../db"
import { ORIGIN, signedInUser } from "../helpers/auth"

let editor: string
let author: string
let intake: string
const created: string[] = []

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  author = (await signedInUser(["author"])).cookie
  intake = (await signedInUser(["intake"])).cookie
})

afterAll(async () => {
  const disk = diskStorage()
  for (const key of created) await disk.delete(key)
})

async function upload(
  cookie: string,
  file: { bytes: Uint8Array | Buffer; name: string; type: string },
  alt?: string
) {
  const form = new FormData()
  form.append(
    "file",
    new File([new Uint8Array(file.bytes)], file.name, { type: file.type })
  )
  if (alt !== undefined) form.append("alt", alt)
  const res = await app.request("/api/v1/admin/media/upload", {
    method: "POST",
    headers: { origin: ORIGIN, cookie },
    body: form,
  })
  const body = (await res.json()) as MediaItem & {
    error?: { fieldErrors?: Record<string, string[]> }
  }
  if (res.status === 201)
    created.push(body.url.replace("/api/v1/media/file/", ""))
  return { status: res.status, body }
}

const png = () =>
  sharp({
    create: { width: 64, height: 48, channels: 3, background: "#0d1b36" },
  })
    .png()
    .toBuffer()

describe("POST /api/v1/admin/media/upload", () => {
  it("stores on disk while R2 is unset and serves it immutable (Review Focus 3)", async () => {
    const bytes = await png()
    const { status, body } = await upload(
      editor,
      { bytes, name: "Hero Photo.png", type: "image/png" },
      "Night patrol"
    )
    expect(status).toBe(201)
    expect(body).toMatchObject({
      mime: "image/png",
      width: 64,
      height: 48,
      size: expect.any(Number), // re-encoded copy; checked against the served file below
      alt: "Night patrol",
      originalName: "Hero Photo.png",
      driver: "disk",
      focalX: null,
      focalY: null,
    })
    expect(body.url).toMatch(
      /^\/api\/v1\/media\/file\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/
    )
    const [row] = await getDb()
      .select()
      .from(media)
      .where(eq(media.id, body.id))
    expect(row.blurDataUrl).toMatch(/^data:image\/webp;base64,/)

    const file = await app.request(body.url)
    expect(file.status).toBe(200)
    expect(file.headers.get("content-type")).toBe("image/png")
    expect(file.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable"
    )
    // The stored file is a re-encoded, metadata-free copy (fix round 1).
    const served = Buffer.from(await file.arrayBuffer())
    expect(served.byteLength).toBe(body.size)
    expect(await sharp(served).metadata()).toMatchObject({
      format: "png",
      width: 64,
      height: 48,
    })

    const audit = await getDb()
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, body.id))
    expect(audit.map((a) => a.action)).toEqual(["media.uploaded"])
  })

  it("trusts the bytes, not the declared type", async () => {
    const jpeg = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#fff" },
    })
      .jpeg()
      .toBuffer()
    const disguised = await upload(author, {
      bytes: jpeg,
      name: "x.png",
      type: "image/png",
    })
    expect(disguised.status).toBe(201)
    expect(disguised.body.mime).toBe("image/jpeg")
    expect(disguised.body.url).toMatch(/\.jpg$/)

    const textAsPng = await upload(author, {
      bytes: Buffer.from("not an image"),
      name: "x.png",
      type: "image/png",
    })
    expect(textAsPng.status).toBe(422)
    expect(textAsPng.body.error?.fieldErrors?.file?.[0]).toMatch(
      /JPEG, PNG, WebP, AVIF, SVG or PDF/
    )

    const gif = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#fff" },
    })
      .gif()
      .toBuffer()
    expect(
      (await upload(author, { bytes: gif, name: "a.gif", type: "image/gif" }))
        .status
    ).toBe(422)
  })

  it("sanitises SVG and serves it with a sandbox CSP", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10"/></svg>'
    )
    const { status, body } = await upload(editor, {
      bytes: svg,
      name: "logo.svg",
      type: "image/svg+xml",
    })
    expect(status).toBe(201)
    expect(body).toMatchObject({ mime: "image/svg+xml", width: 10, height: 10 })
    const file = await app.request(body.url)
    const text = await file.text()
    expect(text).not.toContain("script")
    expect(text).not.toContain("onload")
    expect(file.headers.get("content-security-policy")).toContain("sandbox")
  })

  it("accepts PDFs (no dimensions)", async () => {
    const { status, body } = await upload(editor, {
      bytes: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
      name: "Price list.pdf",
      type: "application/pdf",
    })
    expect(status).toBe(201)
    expect(body).toMatchObject({
      mime: "application/pdf",
      width: null,
      height: null,
    })
    const file = await app.request(body.url)
    expect(file.headers.get("content-disposition")).toBe(
      "inline; filename*=UTF-8''Price%20list.pdf"
    )
  })

  it("rejects a missing file, an empty file and a file over 20 MB", async () => {
    const empty = await app.request("/api/v1/admin/media/upload", {
      method: "POST",
      headers: { origin: ORIGIN, cookie: editor },
      body: new FormData(),
    })
    expect(empty.status).toBe(422)
    expect(
      (
        await upload(editor, {
          bytes: new Uint8Array(),
          name: "a.png",
          type: "image/png",
        })
      ).status
    ).toBe(422)
    const big = new Uint8Array(20 * 1024 * 1024 + 1)
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const tooLarge = await upload(editor, {
      bytes: big,
      name: "big.png",
      type: "image/png",
    })
    expect(tooLarge.status).toBe(422)
    expect(tooLarge.body.error?.fieldErrors?.file?.[0]).toBe(
      "Files can be up to 20 MB"
    )
    const tooBigBody = await upload(editor, {
      bytes: new Uint8Array(21 * 1024 * 1024),
      name: "huge.png",
      type: "image/png",
    })
    expect(tooBigBody.status).toBe(413)
  })

  it("needs media:create", async () => {
    expect(
      (
        await upload(intake, {
          bytes: await png(),
          name: "a.png",
          type: "image/png",
        })
      ).status
    ).toBe(403)
  })
})

describe("GET /api/v1/media/file/*", () => {
  it("404s for unknown keys, traversal and static rows", async () => {
    expect(
      (await app.request("/api/v1/media/file/2026/10/nope.png")).status
    ).toBe(404)
    expect(
      (await app.request("/api/v1/media/file/..%2F..%2Fetc%2Fpasswd")).status
    ).toBe(404)
    expect(
      (await app.request("/api/v1/media/file/images/hero.jpg")).status
    ).toBe(404)
  })
})
