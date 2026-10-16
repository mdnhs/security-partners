import { beforeAll, describe, expect, it } from "vitest"

import type { Paginated } from "@/lib/schemas/api/list"
import type { MediaItem } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let author: string
let intake: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  author = (await signedInUser(["author"])).cookie
  intake = (await signedInUser(["intake"])).cookie
})

async function list(cookie: string, qs: string) {
  const res = await adminRequest(`/media?${qs}`, { cookie })
  return {
    status: res.status,
    body: res.ok ? ((await res.json()) as Paginated<MediaItem>) : null,
  }
}

describe("GET /api/v1/admin/media (picker, Phase 4 read-only)", () => {
  it("pages through seeded library images with their public URLs", async () => {
    const { status, body } = await list(
      author,
      "kind=image&pageSize=10&sort=alt:asc"
    )
    expect(status).toBe(200)
    expect(body!.items).toHaveLength(10)
    expect(body!.total).toBeGreaterThanOrEqual(30)
    expect(body!.items[0].url).toMatch(/^\/images\//)
    expect(body!.items.every((i) => i.mime.startsWith("image/"))).toBe(true)
  })

  it("searches alt text and file names", async () => {
    const { body } = await list(author, "q=hero.jpg")
    expect(body!.items.map((i) => i.url)).toEqual(["/images/hero.jpg"])
    const item = body!.items[0]
    const one = await adminRequest(`/media/${item.id}`, { cookie: author })
    expect(await one.json()).toEqual(item)
  })

  it("requires media:read", async () => {
    expect((await list(intake, "")).status).toBe(403)
    expect(
      (
        await adminRequest("/media/00000000-0000-7000-8000-000000000999", {
          cookie: author,
        })
      ).status
    ).toBe(404)
  })
})
