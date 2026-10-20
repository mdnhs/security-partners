import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Hono runs outside Next: record draft-mode calls.
const { enable, disable } = vi.hoisted(() => ({
  enable: vi.fn(),
  disable: vi.fn(),
}))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  draftMode: async () => ({ isEnabled: false, enable, disable }),
}))

import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  PREVIEW_COOKIE,
  verifyPreviewToken,
} from "@/server/modules/preview/token"

import { resetDb } from "../db"
import { ORIGIN, signedInUser } from "../helpers/auth"

let editor: { cookie: string; user: { id: string } }
let intake: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = await signedInUser(["editor"])
  intake = (await signedInUser(["intake"])).cookie
})

beforeEach(() => {
  enable.mockClear()
  disable.mockClear()
})

/** The preview link as a browser opens it from the admin (new tab). */
function openPreview(
  query: string,
  opts: { cookie?: string; site?: string | null } = {}
) {
  const headers: Record<string, string> = {}
  if (opts.cookie) headers.cookie = opts.cookie
  const site = opts.site === undefined ? "same-origin" : opts.site
  if (site !== null) headers["sec-fetch-site"] = site
  return app.request(`/api/v1/admin/preview?${query}`, { headers })
}

const previewCookie = (res: Response) =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${PREVIEW_COOKIE}=`))

describe("preview (master 4.4)", () => {
  it("enables draft mode, sets a signed cookie for the user and redirects to the page", async () => {
    const res = await openPreview("entity=page&id=about", {
      cookie: editor.cookie,
    })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/about")
    expect(enable).toHaveBeenCalledTimes(1)
    const cookie = previewCookie(res)!
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Max-Age=3600/)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).not.toMatch(/Secure/i)
    const token = decodeURIComponent(cookie.split(";")[0].split("=")[1])
    expect(verifyPreviewToken(token)).toEqual({ userId: editor.user.id })
  })

  it("previews services at their public URL and settings on the home page", async () => {
    const [service] = await getDb()
      .select()
      .from(services)
      .where(eq(services.slug, "static-security"))
    const one = await openPreview(`entity=service&id=${service.id}`, {
      cookie: editor.cookie,
    })
    expect(one.headers.get("location")).toBe("/services/static-security")
    const settings = await openPreview("entity=settings&id=footer", {
      cookie: editor.cookie,
    })
    expect(settings.headers.get("location")).toBe("/")
  })

  it("previews the theme draft for appearance readers only (C5)", async () => {
    // A marketer reads appearance but not settings.
    const marketer = (await signedInUser(["marketer"])).cookie
    const theme = await openPreview("entity=settings&id=theme", {
      cookie: marketer,
    })
    expect(theme.status).toBe(302)
    expect(theme.headers.get("location")).toBe("/")
    // Other settings still need settings:read.
    expect(
      (await openPreview("entity=settings&id=footer", { cookie: marketer }))
        .status
    ).toBe(403)
    // No appearance:read, no theme preview.
    const author = (await signedInUser(["author"])).cookie
    expect(
      (await openPreview("entity=settings&id=theme", { cookie: author })).status
    ).toBe(403)
  })

  it("requires a session and read permission", async () => {
    expect((await openPreview("entity=page&id=home")).status).toBe(401)
    expect(
      (await openPreview("entity=page&id=home", { cookie: intake })).status
    ).toBe(403)
    expect(
      (
        await openPreview("entity=page&id=nope", {
          cookie: editor.cookie,
        })
      ).status
    ).toBe(404)
    expect(
      (
        await openPreview("entity=service&id=nope", {
          cookie: editor.cookie,
        })
      ).status
    ).toBe(404)
    expect(enable).not.toHaveBeenCalled()
  })

  it("refuses to enable preview from a cross-site navigation", async () => {
    for (const site of ["cross-site", "same-site", null]) {
      const res = await openPreview("entity=page&id=about", {
        cookie: editor.cookie,
        site,
      })
      expect(res.status).toBe(403)
      expect(previewCookie(res)).toBeUndefined()
    }
    const typed = await openPreview("entity=page&id=about", {
      cookie: editor.cookie,
      site: "none",
    })
    expect(typed.status).toBe(302)
    expect(enable).toHaveBeenCalledTimes(1)
  })

  it("marks the cookie Secure when the app runs on https", async () => {
    const previous = process.env.BETTER_AUTH_URL
    process.env.BETTER_AUTH_URL = "https://security-partners.example"
    try {
      const res = await app.request("/api/v1/preview/exit")
      expect(previewCookie(res)).toMatch(/Secure/)
      expect(previewCookie(res)).toMatch(/Path=\//)
    } finally {
      process.env.BETTER_AUTH_URL = previous
    }
  })

  it("exit disables draft mode, clears the cookie and returns to the page", async () => {
    const res = await app.request("/api/v1/preview/exit", {
      headers: { referer: `${ORIGIN}/services/static-security` },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/services/static-security")
    expect(disable).toHaveBeenCalledTimes(1)
    expect(previewCookie(res)).toMatch(/Max-Age=0/)
    // Next drops Max-Age=0 when it merges its own cookies; Expires survives.
    expect(previewCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/)
    const foreign = await app.request("/api/v1/preview/exit", {
      headers: { referer: "https://evil.example/x" },
    })
    expect(foreign.headers.get("location")).toBe("/")
  })

  it("exit returns to ?to (the page the guard left), checked like the Referer", async () => {
    const back = async (to: string, referer?: string) => {
      const res = await app.request(
        `/api/v1/preview/exit?to=${encodeURIComponent(to)}`,
        { headers: referer ? { referer } : {} }
      )
      return res.headers.get("location")
    }
    expect(await back("/terms")).toBe("/terms")
    expect(await back("/blog/x?page=2", `${ORIGIN}/about`)).toBe(
      "/blog/x?page=2"
    )
    for (const unsafe of [
      "//evil.example/x",
      "https://evil.example/x",
      "/\\evil.example",
      "/admin/users",
      "/api/v1/x",
    ])
      expect(await back(unsafe), unsafe).toBe("/")
  })
})
