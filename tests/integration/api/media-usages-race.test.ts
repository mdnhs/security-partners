import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

// Wrap the existence check so a test can delete a media row right after it
// passes — the race syncMediaUsages must survive (FK 23503 → 422).
vi.mock("@/server/modules/media/repo", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/media/repo")>()
  return { ...actual, existingMediaIds: vi.fn(actual.existingMediaIds) }
})

import type { PageDto } from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import { media, pages } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  existingMediaIds,
  listMediaUsagesFor,
} from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
})

describe("media usages: image deleted between check and insert", () => {
  it("answers 422 on the field and leaves the page untouched", async () => {
    const db = getDb()
    const [victim] = await db
      .insert(media)
      .values({
        key: "/images/race.png",
        driver: "static",
        mime: "image/png",
        size: 1,
      })
      .returning({ id: media.id })
    const real = vi.mocked(existingMediaIds).getMockImplementation()!
    vi.mocked(existingMediaIds).mockImplementationOnce(async (tx, ids) => {
      const found = await real(tx, ids)
      // Another session deletes the image after the check passed.
      await getDb().delete(media).where(eq(media.id, victim.id))
      return found
    })

    const home = (await (
      await adminRequest("/pages/home", { cookie: editor })
    ).json()) as PageDto
    const draft = structuredClone(home.draft) as {
      hero: { backgroundImage: { mediaId: string } }
    }
    draft.hero.backgroundImage = { mediaId: victim.id }
    const res = await adminRequest("/pages/home/draft", {
      cookie: editor,
      method: "PUT",
      json: { draft, version: 1 },
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toEqual([
      "hero.backgroundImage",
    ])
    const [row] = await db.select().from(pages).where(eq(pages.key, "home"))
    expect(row.version).toBe(1)
    expect(
      (await listMediaUsagesFor(db, "page", "home")).some(
        (u) => u.mediaId === victim.id
      )
    ).toBe(false)
  })
})
