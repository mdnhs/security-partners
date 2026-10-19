import { beforeEach, describe, expect, it, vi } from "vitest"

const repo = vi.hoisted(() => ({
  findRedirectByFrom: vi.fn(),
  incrementRedirectHits: vi.fn(),
  isPublishedSlug: vi.fn(),
}))
vi.mock("@/server/modules/redirects/repo", () => repo)
vi.mock("@/server/db/client", () => ({ getDb: vi.fn(() => ({})) }))

import { resolvePublicPath } from "@/server/modules/redirects/resolve"

const live = { draft: false }

beforeEach(() => {
  vi.clearAllMocks()
  repo.findRedirectByFrom.mockResolvedValue(null)
  repo.isPublishedSlug.mockResolvedValue(false)
})

describe("resolvePublicPath: /p/<slug> (proxy cost)", () => {
  it("the draft cookie passes without a query", async () => {
    expect(await resolvePublicPath("/p/anything", { draft: true })).toEqual({
      kind: "pass",
    })
    expect(repo.isPublishedSlug).not.toHaveBeenCalled()
    expect(repo.findRedirectByFrom).not.toHaveBeenCalled()
  })

  it("malformed or reserved slugs never reach the builder lookup", async () => {
    for (const path of ["/p/Upper", "/p/admin", `/p/${"x".repeat(61)}`])
      expect(await resolvePublicPath(path, live), path).toEqual({
        kind: "missing",
      })
    expect(repo.isPublishedSlug).not.toHaveBeenCalled()
  })

  it("published → pass with one query; unpublished → redirect lookup → missing", async () => {
    repo.isPublishedSlug.mockResolvedValueOnce(true)
    expect(await resolvePublicPath("/p/landing", live)).toEqual({
      kind: "pass",
    })
    expect(repo.findRedirectByFrom).not.toHaveBeenCalled()
    expect(await resolvePublicPath("/p/landing", live)).toEqual({
      kind: "missing",
    })
    expect(repo.findRedirectByFrom).toHaveBeenCalledWith({}, "/p/landing")
  })

  it("a live page beats a stored redirect from its own address", async () => {
    repo.isPublishedSlug.mockResolvedValueOnce(true)
    repo.findRedirectByFrom.mockResolvedValue({
      id: "r1",
      toPath: "/",
      code: 301,
    })
    expect(await resolvePublicPath("/p/back", live)).toEqual({ kind: "pass" })
    expect(repo.isPublishedSlug).toHaveBeenCalledWith({}, "builder", "back")
    expect(repo.findRedirectByFrom).not.toHaveBeenCalled()
  })

  it("deeper paths under /p/ are not builder pages (catch-all 404 via pass)", async () => {
    expect(await resolvePublicPath("/p/a/b", live)).toEqual({ kind: "pass" })
    expect(repo.isPublishedSlug).not.toHaveBeenCalled()
  })
})
