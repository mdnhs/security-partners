import { beforeEach, describe, expect, it, vi } from "vitest"

const repo = vi.hoisted(() => ({
  findRedirectByFrom: vi.fn(),
  incrementRedirectHits: vi.fn(),
  isPublishedSlug: vi.fn(),
}))
vi.mock("@/server/modules/redirects/repo", () => repo)
const db = vi.hoisted(() => ({ getDb: vi.fn(() => ({})) }))
vi.mock("@/server/db/client", () => db)

import { resolvePublicPath } from "@/server/modules/redirects/resolve"

const live = { draft: false }

beforeEach(() => {
  for (const fn of Object.values(repo)) fn.mockReset()
  repo.findRedirectByFrom.mockResolvedValue(null)
  repo.isPublishedSlug.mockResolvedValue(false)
  repo.incrementRedirectHits.mockResolvedValue(undefined)
})

describe("resolvePublicPath (proxy.ts)", () => {
  it("fixed pages, files and internal paths never touch the database", async () => {
    for (const path of [
      "/",
      "/about",
      "/blog",
      "/privacy",
      "/robots-old.txt",
      "/_sp-missing",
    ])
      expect(await resolvePublicPath(path, live), path).toEqual({
        kind: "pass",
      })
    expect(repo.isPublishedSlug).not.toHaveBeenCalled()
    expect(repo.findRedirectByFrom).not.toHaveBeenCalled()
  })

  it("newsletter state pages pass without a query; other /newsletter paths are missing", async () => {
    for (const path of [
      "/newsletter/confirm",
      "/newsletter/confirmed",
      "/newsletter/invalid",
      "/newsletter/unsubscribe",
      "/newsletter/unsubscribed",
    ])
      expect(await resolvePublicPath(path, live), path).toEqual({
        kind: "pass",
      })
    for (const path of ["/newsletter", "/newsletter/nope", "/newsletter/a/b"])
      expect(await resolvePublicPath(path, live), path).toEqual({
        kind: "missing",
      })
    expect(repo.findRedirectByFrom).not.toHaveBeenCalled()
  })

  it("a published slug passes; an unknown one is missing", async () => {
    repo.isPublishedSlug.mockResolvedValueOnce(true)
    expect(await resolvePublicPath("/services/alarm-responses", live)).toEqual({
      kind: "pass",
    })
    expect(repo.isPublishedSlug).toHaveBeenCalledWith(
      {},
      "service",
      "alarm-responses"
    )
    expect(await resolvePublicPath("/blog/nope", live)).toEqual({
      kind: "missing",
    })
    expect(await resolvePublicPath("/blog/Not_A_Slug", live)).toEqual({
      kind: "missing",
    })
  })

  it("a redirect wins over the 404 and counts its hit on demand", async () => {
    repo.findRedirectByFrom.mockResolvedValue({
      id: "r1",
      toPath: "/services/new",
      code: 301,
    })
    const outcome = await resolvePublicPath("/services/old", live)
    expect(outcome).toMatchObject({
      kind: "redirect",
      to: "/services/new",
      code: 301,
    })
    expect(repo.incrementRedirectHits).not.toHaveBeenCalled()
    if (outcome.kind === "redirect") await outcome.recordHit()
    expect(repo.incrementRedirectHits).toHaveBeenCalledWith({}, "r1")
  })

  it("other unknown paths: redirect if one exists, else pass (catch-all 404)", async () => {
    expect(await resolvePublicPath("/old-page", live)).toEqual({ kind: "pass" })
    repo.findRedirectByFrom.mockResolvedValue({
      id: "r2",
      toPath: "https://x.ie/",
      code: 302,
    })
    expect(await resolvePublicPath("/old-page", live)).toMatchObject({
      kind: "redirect",
      code: 302,
    })
  })

  it("previews skip the slug check; database errors never block a page", async () => {
    expect(await resolvePublicPath("/services/draft", { draft: true })).toEqual(
      {
        kind: "pass",
      }
    )
    expect(repo.isPublishedSlug).not.toHaveBeenCalled()
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    repo.isPublishedSlug.mockRejectedValueOnce(new Error("db down"))
    expect(await resolvePublicPath("/services/x", live)).toEqual({
      kind: "pass",
    })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it("logs only the error code, never the message (it may carry the URL)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    repo.findRedirectByFrom.mockRejectedValueOnce(
      Object.assign(new Error("password authentication failed for sp"), {
        code: "28P01",
      })
    )
    expect(await resolvePublicPath("/old-page", live)).toEqual({ kind: "pass" })
    const logged = log.mock.calls.flat().join(" ")
    expect(logged).toContain("28P01")
    expect(logged).not.toContain("password")
    log.mockRestore()
  })

  it("hits that arrive while one is being written coalesce into one write", async () => {
    repo.findRedirectByFrom.mockResolvedValue({
      id: "r3",
      toPath: "/services/new",
      code: 301,
    })
    let release: () => void = () => undefined
    repo.incrementRedirectHits.mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve))
    )
    const outcome = await resolvePublicPath("/hot", live)
    if (outcome.kind !== "redirect") throw new Error("expected a redirect")
    const first = outcome.recordHit()
    const rest = Array.from({ length: 50 }, () => outcome.recordHit())
    await vi.waitFor(() =>
      expect(repo.incrementRedirectHits).toHaveBeenCalledTimes(1)
    )
    release()
    await Promise.all([first, ...rest])
    expect(repo.incrementRedirectHits).toHaveBeenCalledTimes(2)
    expect(repo.incrementRedirectHits).toHaveBeenNthCalledWith(1, {}, "r3")
    expect(repo.incrementRedirectHits).toHaveBeenNthCalledWith(2, {}, "r3", 50)
  })

  it("a failed hit write is swallowed (logged) and the next one still runs", async () => {
    repo.findRedirectByFrom.mockResolvedValue({
      id: "r4",
      toPath: "/services/new",
      code: 301,
    })
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    repo.incrementRedirectHits.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { code: "57P01" })
    )
    const outcome = await resolvePublicPath("/hot2", live)
    if (outcome.kind !== "redirect") throw new Error("expected a redirect")
    await expect(outcome.recordHit()).resolves.toBeUndefined()
    expect(log.mock.calls.flat().join(" ")).toContain("57P01")
    await outcome.recordHit()
    expect(repo.incrementRedirectHits).toHaveBeenCalledTimes(2)
    log.mockRestore()
  })

  it("recordHit never throws, even when getDb() throws synchronously", async () => {
    repo.findRedirectByFrom.mockResolvedValue({
      id: "r5",
      toPath: "/services/new",
      code: 301,
    })
    const outcome = await resolvePublicPath("/hot3", live)
    if (outcome.kind !== "redirect") throw new Error("expected a redirect")
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    db.getDb.mockImplementationOnce(() => {
      throw new Error("DATABASE_URL is not set")
    })
    let hit: Promise<void> | undefined
    expect(() => {
      hit = outcome.recordHit()
    }).not.toThrow()
    await expect(hit).resolves.toBeUndefined()
    const logged = log.mock.calls.flat().join(" ")
    expect(logged).toContain("[proxy] redirect hits not counted")
    expect(logged).not.toContain("DATABASE_URL")
    expect(repo.incrementRedirectHits).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
