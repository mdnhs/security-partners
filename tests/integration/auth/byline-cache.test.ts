import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { resetDb } from "../db"
import {
  adminRequest,
  authPost,
  createUser,
  signedInUser,
} from "../helpers/auth"

beforeEach(async () => {
  await resetDb()
  revalidateTag.mockClear()
})

const expiredArticles = () =>
  revalidateTag.mock.calls.filter(([t]) => t === "articles")

describe("bylines come from user profiles (spec §5.3, ledger carry)", () => {
  it("a profile change through Better Auth expires the cached articles", async () => {
    const { cookie } = await signedInUser(["author"])
    expect(expiredArticles()).toEqual([])
    const res = await authPost(
      "/update-user",
      { name: "Arthur Author", title: "Operations Lead" },
      cookie
    )
    expect(res.status).toBe(200)
    expect(expiredArticles()).toEqual([["articles", { expire: 0 }]])
  })

  it("an admin renaming a user expires the cached articles", async () => {
    const admin = await signedInUser(["admin"])
    const target = await createUser({ roles: ["author"] })
    revalidateTag.mockClear()
    const res = await adminRequest(`/users/${target.id}`, {
      cookie: admin.cookie,
      method: "PATCH",
      json: { title: "Managing Director" },
    })
    expect(res.status).toBe(200)
    expect(expiredArticles()).toEqual([["articles", { expire: 0 }]])
  })

  it("role changes and bans do not touch the public cache", async () => {
    const admin = await signedInUser(["admin"])
    const target = await createUser({ roles: ["author"] })
    revalidateTag.mockClear()
    await adminRequest(`/users/${target.id}/roles`, {
      cookie: admin.cookie,
      method: "PUT",
      json: { roles: ["editor"] },
    })
    await adminRequest(`/users/${target.id}/ban`, {
      cookie: admin.cookie,
      method: "POST",
      json: {},
    })
    expect(expiredArticles()).toEqual([])
  })
})
