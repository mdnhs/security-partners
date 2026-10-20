import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { Paginated } from "@/lib/schemas/api/list"
import type { MediaItem } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import { auditLog, media } from "@/server/db/schema"
import { altSummary } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let author: string
type Row = typeof media.$inferSelect
let noAltImage: Row
let describedImage: Row
let decorativeImage: Row
let pdf: Row

const row = async (values: Partial<typeof media.$inferInsert>) =>
  (
    await getDb()
      .insert(media)
      .values({
        key: `/images/${crypto.randomUUID()}.png`,
        driver: "static",
        mime: "image/png",
        size: 10,
        ...values,
      })
      .returning()
  )[0]

let authorId: string

// Fresh rows and users per test: no test depends on another's changes (review M5).
beforeEach(async () => {
  await resetDb()
  noAltImage = await row({ originalName: "no-alt.png" })
  describedImage = await row({ alt: "Patrol car", originalName: "car.png" })
  decorativeImage = await row({
    isDecorative: true,
    originalName: "swirl.png",
  })
  pdf = await row({ mime: "application/pdf", originalName: "prices.pdf" })
  editor = (await signedInUser(["editor"])).cookie
  const signedInAuthor = await signedInUser(["author"])
  author = signedInAuthor.cookie
  authorId = signedInAuthor.user.id
})

async function list(qs: string) {
  const res = await adminRequest(`/media?${qs}`, { cookie: editor })
  expect(res.status).toBe(200)
  return (await res.json()) as Paginated<MediaItem>
}

describe("media alt text: decorative flag, caption, missing-alt filter", () => {
  it("missingAlt lists images with empty alt that are not decorative, never PDFs", async () => {
    const body = await list("missingAlt=true")
    expect(body.items.map((i) => i.id)).toEqual([noAltImage.id])
    expect(body.total).toBe(1)
    // Without the filter every row is listed, each with the new fields.
    const all = await list("")
    expect(all.total).toBe(4)
    expect(all.items.find((i) => i.id === decorativeImage.id)).toMatchObject({
      isDecorative: true,
      caption: "",
    })
    expect(all.items.find((i) => i.id === pdf.id)).toMatchObject({
      isDecorative: false,
      caption: "",
    })
    // Any other value is refused.
    expect(
      (await adminRequest("/media?missingAlt=yes", { cookie: editor })).status
    ).toBe(422)
  })

  it("PATCH isDecorative + caption round-trips; caption > 300 → 422", async () => {
    const res = await adminRequest(`/media/${describedImage.id}`, {
      cookie: editor,
      method: "PATCH",
      json: { isDecorative: true, caption: "  Night​ patrol \u0007" },
    })
    expect(res.status).toBe(200)
    // Decorative keeps the alt text as entered; the caption is cleaned like alt.
    expect(await res.json()).toMatchObject({
      id: describedImage.id,
      alt: "Patrol car",
      isDecorative: true,
      caption: "Night patrol",
    })
    const one = (await (
      await adminRequest(`/media/${describedImage.id}`, { cookie: editor })
    ).json()) as MediaItem
    expect(one).toMatchObject({ isDecorative: true, caption: "Night patrol" })

    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, describedImage.id))
    expect(audit.diff).toMatchObject({
      isDecorative: { from: false, to: true },
      caption: { from: "", to: "Night patrol" },
    })

    const tooLong = await adminRequest(`/media/${describedImage.id}`, {
      cookie: editor,
      method: "PATCH",
      json: { caption: "x".repeat(301) },
    })
    expect(tooLong.status).toBe(422)
    const ok = await adminRequest(`/media/${describedImage.id}`, {
      cookie: editor,
      method: "PATCH",
      json: { caption: "x".repeat(300), isDecorative: false },
    })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({
      caption: "x".repeat(300),
      isDecorative: false,
      alt: "Patrol car",
    })
    // isDecorative must be a boolean.
    expect(
      (
        await adminRequest(`/media/${describedImage.id}`, {
          cookie: editor,
          method: "PATCH",
          json: { isDecorative: "yes" },
        })
      ).status
    ).toBe(422)
  })

  it("an uploader cannot describe someone else's file", async () => {
    const res = await adminRequest(`/media/${noAltImage.id}`, {
      cookie: author,
      method: "PATCH",
      json: { isDecorative: true },
    })
    expect(res.status).toBe(403)
  })

  it("an uploader describes their own file", async () => {
    const own = await row({ originalName: "mine.png", createdBy: authorId })
    const res = await adminRequest(`/media/${own.id}`, {
      cookie: author,
      method: "PATCH",
      json: { isDecorative: true, caption: "Night\nshift" },
    })
    expect(res.status).toBe(200)
    // Line breaks become a space, so words never merge (review M1).
    expect(await res.json()).toMatchObject({
      id: own.id,
      isDecorative: true,
      caption: "Night shift",
    })
  })

  it("the audit diff lists only fields that changed (review M3)", async () => {
    const res = await adminRequest(`/media/${describedImage.id}`, {
      cookie: editor,
      method: "PATCH",
      // What the form sends: every field, only the alt text changed.
      json: {
        alt: "Patrol car at night",
        isDecorative: false,
        caption: "",
        focal: null,
      },
    })
    expect(res.status).toBe(200)
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, describedImage.id))
    expect(audit.diff).toHaveProperty("alt", {
      from: "Patrol car",
      to: "Patrol car at night",
    })
    expect(audit.diff).not.toHaveProperty("isDecorative")
    expect(audit.diff).not.toHaveProperty("caption")
  })

  it("altSummary counts", async () => {
    expect(await altSummary(getDb())).toEqual({
      images: 3,
      described: 1,
      decorative: 1,
      missing: 1,
    })
    // A decorative image with alt text still counts as decorative (once).
    await getDb()
      .update(media)
      .set({ alt: "Swirl" })
      .where(eq(media.id, decorativeImage.id))
    expect(await altSummary(getDb())).toEqual({
      images: 3,
      described: 1,
      decorative: 1,
      missing: 1,
    })
  })
})
