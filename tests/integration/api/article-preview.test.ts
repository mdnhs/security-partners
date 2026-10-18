import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"

const { enable } = vi.hoisted(() => ({ enable: vi.fn() }))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  draftMode: async () => ({ isEnabled: false, enable, disable: vi.fn() }),
}))

import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { articles } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { signedInUser } from "../helpers/auth"

/** The preview link as the admin opens it (same-origin navigation). */
const adminRequest = (path: string, opts: { cookie: string }) =>
  app.request(`/api/v1/admin${path}`, {
    headers: { cookie: opts.cookie, "sec-fetch-site": "same-origin" },
  })

let author: string
let intake: string
let id: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  author = (await signedInUser(["author"])).cookie
  intake = (await signedInUser(["intake"])).cookie
  const [row] = await getDb()
    .select()
    .from(articles)
    .where(eq(articles.slug, "key-holding-explained"))
  id = row.id
})

describe("article preview (master 5.3)", () => {
  it("opens the article's public URL in draft mode for any article reader", async () => {
    const res = await adminRequest(`/preview?entity=article&id=${id}`, {
      cookie: author,
    })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/blog/key-holding-explained")
    expect(enable).toHaveBeenCalledTimes(1)
  })

  it("needs article:read and an existing article", async () => {
    expect(
      (
        await adminRequest(`/preview?entity=article&id=${id}`, {
          cookie: intake,
        })
      ).status
    ).toBe(403)
    expect(
      (
        await adminRequest(
          "/preview?entity=article&id=0190f0e0-0000-7000-8000-000000000999",
          { cookie: author }
        )
      ).status
    ).toBe(404)
    expect(
      (
        await adminRequest("/preview?entity=article&id=nope", {
          cookie: author,
        })
      ).status
    ).toBe(404)
  })
})
