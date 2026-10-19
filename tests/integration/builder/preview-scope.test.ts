import { beforeEach, describe, expect, it, vi } from "vitest"

// Outside Next: draft mode on, the request's cookies from `jar`.
const { jar } = vi.hoisted(() => ({ jar: { cookie: "" } }))
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("next/headers", async (importOriginal) => {
  const pairs = () =>
    jar.cookie
      .split(/;\s*/)
      .filter(Boolean)
      .map((pair) => {
        const [name, ...value] = pair.split("=")
        return { name, value: value.join("=") }
      })
  return {
    ...(await importOriginal<typeof import("next/headers")>()),
    draftMode: async () => ({
      isEnabled: true,
      enable: vi.fn(),
      disable: vi.fn(),
    }),
    cookies: async () => ({
      get: (name: string) => pairs().find((c) => c.name === name),
    }),
    headers: async () => new Headers({ cookie: jar.cookie }),
  }
})

import type { BuilderDocument } from "@/blocks/document"
import type { Role } from "@/lib/auth/roles"
import { getDb } from "@/server/db/client"
import { builderPages } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { getBuilderPageForRequest } from "@/server/modules/builder-pages/queries"
import {
  PREVIEW_COOKIE,
  signPreviewToken,
} from "@/server/modules/preview/token"

import { resetDb } from "../db"
import { signedInUser } from "../helpers/auth"

const doc = (anchor: string): BuilderDocument => ({
  blocks: [
    {
      id: `block-${anchor}`,
      type: "map",
      anchor,
      hidden: false,
      data: { useShared: true },
    },
  ],
})

async function insertPage(slug: string, published: boolean) {
  await getDb()
    .insert(builderPages)
    .values({
      slug,
      title: slug,
      draft: doc("draft-copy"),
      published: published ? doc("live-copy") : null,
      status: published ? "published" : "draft",
      publishedAt: published ? new Date() : null,
      seo: {},
    })
}

/** Signed in as `roles` with a valid preview cookie (e.g. from an article preview). */
async function previewAs(roles: Role[]) {
  const { user, cookie } = await signedInUser(roles)
  jar.cookie = `${cookie}; ${PREVIEW_COOKIE}=${signPreviewToken(user.id)}`
}

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  await insertPage("draft-only", false)
  await insertPage("live", true)
  jar.cookie = ""
})

describe("builder drafts in preview need page:read (D5.3 review minor 1)", () => {
  it("an author previewing an article cannot see a builder draft", async () => {
    await previewAs(["author"])
    expect(await getBuilderPageForRequest("draft-only")).toBeNull()
    // A published page shows its published version, not the draft.
    const live = await getBuilderPageForRequest("live")
    expect(live?.doc.blocks.map((b) => b.anchor)).toEqual(["live-copy"])
  })

  it("an editor (page:read) previews the draft", async () => {
    await previewAs(["editor"])
    const draft = await getBuilderPageForRequest("draft-only")
    expect(draft?.doc.blocks.map((b) => b.anchor)).toEqual(["draft-copy"])
    const live = await getBuilderPageForRequest("live")
    expect(live?.doc.blocks.map((b) => b.anchor)).toEqual(["draft-copy"])
  })

  it("draft mode without a preview session shows no draft", async () => {
    expect(await getBuilderPageForRequest("draft-only")).toBeNull()
  })
})
