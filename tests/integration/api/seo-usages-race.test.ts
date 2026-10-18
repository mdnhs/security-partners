import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

// The first record read inside PUT /seo/entries runs a hook: another
// session saves the page's draft right then. Whatever updateSeo reads its
// content with must hold the row, or that draft's new image loses its
// media_usages row when the SEO save syncs from the content it read.
const hook = vi.hoisted(() => ({
  run: null as null | (() => Promise<void>),
}))
vi.mock("@/server/modules/seo/repo", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/seo/repo")>()
  const wrap =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const result = await fn(...args)
      const run = hook.run
      hook.run = null
      if (run) await run()
      return result
    }
  const wrapped: Record<string, unknown> = { ...actual }
  for (const name of ["findSeoRow", "lockSeoMediaRow"] as const)
    if (name in actual)
      wrapped[name] = wrap(
        (actual as Record<string, (...a: unknown[]) => Promise<unknown>>)[name]
      )
  return wrapped
})

import type { PageDto } from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import { media } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
})

const newImage = async (key: string) =>
  (
    await getDb()
      .insert(media)
      .values({ key, driver: "static", mime: "image/png", size: 1 })
      .returning({ id: media.id })
  )[0].id

describe("SEO save vs. a concurrent draft save (media usages)", () => {
  it("keeps the draft's new image in use", async () => {
    const share = await newImage("/images/share.png")
    const hero = await newImage("/images/hero-new.png")
    const about = (await (
      await adminRequest("/pages/about", { cookie: editor })
    ).json()) as PageDto
    const draft = structuredClone(about.draft) as {
      hero: { image: { mediaId: string } }
    }
    draft.hero.image = { mediaId: hero }

    let draftSave: Promise<Response> | null = null
    hook.run = async () => {
      draftSave = Promise.resolve(
        adminRequest("/pages/about/draft", {
          cookie: editor,
          method: "PUT",
          json: { draft, version: about.version },
        })
      )
      // Give the draft save time to finish if nothing holds the row.
      await Promise.race([
        draftSave,
        new Promise((resolve) => setTimeout(resolve, 750)),
      ])
    }

    const seo = await adminRequest("/seo/entries/page/about", {
      cookie: editor,
      method: "PUT",
      json: { seo: { ogImage: { mediaId: share } } },
    })
    expect(seo.status).toBe(200)
    expect(draftSave).not.toBeNull()
    expect((await draftSave!).status).toBe(200)

    const usages = await listMediaUsagesFor(getDb(), "page", "about")
    expect(usages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mediaId: hero, field: "hero.image" }),
        expect.objectContaining({ mediaId: share, field: "seo.ogImage" }),
      ])
    )
  })
})
