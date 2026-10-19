import { beforeAll, describe, expect, it, vi } from "vitest"

/**
 * MK parity B5: `requirePage(href)` resolves the page's permission from the
 * nav registry against a real session (Better Auth + Postgres).
 */
const state = vi.hoisted(() => ({ cookie: "" }))

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => new Headers({ cookie: state.cookie }),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  },
  forbidden: () => {
    throw new Error("NEXT_FORBIDDEN")
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND")
  },
}))

import { requirePage } from "@/server/auth/session"

import { resetDb } from "../db"
import { signedInUser } from "../helpers/auth"

let marketer: { cookie: string; id: string }
let owner: { cookie: string; id: string }
let author: { cookie: string; id: string }

beforeAll(async () => {
  await resetDb()
  const sign = async (role: "marketer" | "owner" | "author") => {
    const { cookie, user } = await signedInUser([role])
    return { cookie, id: user.id }
  }
  marketer = await sign("marketer")
  owner = await sign("owner")
  author = await sign("author")
})

describe("requirePage", () => {
  it("forbids a marketer from Custom code (owner only)", async () => {
    state.cookie = marketer.cookie
    await expect(requirePage("/admin/marketing/code")).rejects.toThrow(
      "NEXT_FORBIDDEN"
    )
    // …but the marketer opens Tracking.
    expect((await requirePage("/admin/marketing")).userId).toBe(marketer.id)
    state.cookie = owner.cookie
    expect((await requirePage("/admin/marketing/code")).userId).toBe(owner.id)
  })

  it("404s on an href missing from the registry, for anyone", async () => {
    state.cookie = owner.cookie
    await expect(requirePage("/admin/unknown")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    )
    state.cookie = ""
    await expect(requirePage("/admin/unknown")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    )
  })

  it("lets any signed-in user open a page with no permission (dashboard)", async () => {
    state.cookie = author.cookie
    const actor = await requirePage("/admin")
    expect(actor.userId).toBe(author.id)
    expect(actor.roles).toEqual(["author"])
  })

  it("sends a signed-out visitor to sign-in", async () => {
    state.cookie = ""
    await expect(requirePage("/admin")).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in"
    )
    await expect(requirePage("/admin/insights")).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in"
    )
  })

  it("an author reads Insights but not Users", async () => {
    state.cookie = author.cookie
    expect((await requirePage("/admin/insights")).userId).toBe(author.id)
    await expect(requirePage("/admin/users")).rejects.toThrow("NEXT_FORBIDDEN")
  })
})
