import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { PageDto } from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import { media, pages } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
})

async function setHeroImage(mediaId: string) {
  const home = (await (
    await adminRequest("/pages/home", { cookie: editor })
  ).json()) as PageDto
  const draft = structuredClone(home.draft) as {
    hero: { backgroundImage: { mediaId: string } }
  }
  draft.hero.backgroundImage = { mediaId }
  return adminRequest("/pages/home/draft", {
    cookie: editor,
    method: "PUT",
    json: { draft, version: home.version },
  })
}

describe("media references: every media field is an image field (server-side kind check)", () => {
  it("refuses a PDF in an image field with 422 on that field", async () => {
    const db = getDb()
    const [pdf] = await db
      .insert(media)
      .values({
        key: "/uploads/brochure.pdf",
        driver: "static",
        mime: "application/pdf",
        size: 1,
      })
      .returning({ id: media.id })

    const res = await setHeroImage(pdf.id)
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(body.error.fieldErrors).toEqual({
      "hero.backgroundImage": ["This file is not an image. Choose an image."],
    })
    const [row] = await db.select().from(pages).where(eq(pages.key, "home"))
    expect(row.version).toBe(1)
  })

  it("accepts an image (SVG included)", async () => {
    const [svg] = await getDb()
      .insert(media)
      .values({
        key: "/uploads/mark.svg",
        driver: "static",
        mime: "image/svg+xml",
        size: 1,
      })
      .returning({ id: media.id })
    expect((await setHeroImage(svg.id)).status).toBe(200)
  })
})
