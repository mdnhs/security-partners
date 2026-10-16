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
import { adminRequest, ORIGIN, signedInUser } from "../helpers/auth"

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

const previewCookie = (res: Response) =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${PREVIEW_COOKIE}=`))

describe("preview (master 4.4)", () => {
  it("enables draft mode, sets a signed cookie for the user and redirects to the page", async () => {
    const res = await adminRequest("/preview?entity=page&id=about", {
      cookie: editor.cookie,
    })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/about")
    expect(enable).toHaveBeenCalledTimes(1)
    const cookie = previewCookie(res)!
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Max-Age=3600/)
    const token = decodeURIComponent(cookie.split(";")[0].split("=")[1])
    expect(verifyPreviewToken(token)).toEqual({ userId: editor.user.id })
  })

  it("previews services at their public URL and settings on the home page", async () => {
    const [service] = await getDb()
      .select()
      .from(services)
      .where(eq(services.slug, "static-security"))
    const one = await adminRequest(`/preview?entity=service&id=${service.id}`, {
      cookie: editor.cookie,
    })
    expect(one.headers.get("location")).toBe("/services/static-security")
    const settings = await adminRequest("/preview?entity=settings&id=footer", {
      cookie: editor.cookie,
    })
    expect(settings.headers.get("location")).toBe("/")
  })

  it("requires a session and read permission", async () => {
    expect((await adminRequest("/preview?entity=page&id=home")).status).toBe(
      401
    )
    expect(
      (await adminRequest("/preview?entity=page&id=home", { cookie: intake }))
        .status
    ).toBe(403)
    expect(
      (
        await adminRequest("/preview?entity=page&id=nope", {
          cookie: editor.cookie,
        })
      ).status
    ).toBe(404)
    expect(
      (
        await adminRequest("/preview?entity=service&id=nope", {
          cookie: editor.cookie,
        })
      ).status
    ).toBe(404)
    expect(enable).not.toHaveBeenCalled()
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
})
