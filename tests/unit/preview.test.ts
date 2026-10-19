import { beforeEach, describe, expect, it, vi } from "vitest"

const { draft, jar, requestHeaders, session, redirect } = vi.hoisted(() => ({
  draft: { isEnabled: false },
  jar: new Map<string, string>(),
  requestHeaders: new Map<string, string>(),
  session: {
    current: null as null | { actor: { userId: string; roles: string[] } },
  },
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock("next/headers", () => ({
  draftMode: async () => draft,
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
  }),
  headers: async () => new Headers([...requestHeaders]),
}))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/server/auth/session", () => ({
  getSessionContext: async () => session.current,
}))

import {
  assertPreviewAccess,
  isPreviewing,
} from "@/server/modules/preview/guard"
import { REQUEST_PATH_HEADER } from "@/lib/request-path"
import { hasPermission, ROLE_GRANTS } from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"
import { canPreview, safeReturnPath } from "@/server/modules/preview/service"
import {
  PREVIEW_COOKIE,
  PREVIEW_TTL_SECONDS,
  previewCookieOptions,
  signPreviewToken,
  verifyPreviewToken,
} from "@/server/modules/preview/token"

const SECRET = "unit-secret-0123456789abcdef0123456789abcdef"

beforeEach(() => {
  // signPreviewToken() without an explicit secret reads the app env.
  process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:5432/sp_test"
  process.env.BETTER_AUTH_SECRET = SECRET
  process.env.BETTER_AUTH_URL = "http://localhost:3000"
  draft.isEnabled = false
  jar.clear()
  requestHeaders.clear()
  session.current = null
  redirect.mockClear()
})

describe("preview token (HMAC, HKDF purpose 'preview')", () => {
  const now = Date.UTC(2026, 9, 16, 12)

  it("round-trips the user id until it expires", () => {
    const token = signPreviewToken("user-1", now, SECRET)
    expect(token.split(".")).toHaveLength(3)
    expect(verifyPreviewToken(token, now, SECRET)).toEqual({ userId: "user-1" })
    expect(
      verifyPreviewToken(token, now + (PREVIEW_TTL_SECONDS - 1) * 1000, SECRET)
    ).not.toBeNull()
    expect(
      verifyPreviewToken(token, now + PREVIEW_TTL_SECONDS * 1000, SECRET)
    ).toBeNull()
  })

  it("rejects tampering, other secrets and garbage", () => {
    const token = signPreviewToken("user-1", now, SECRET)
    const [, expires, sig] = token.split(".")
    expect(
      verifyPreviewToken(`user-2.${expires}.${sig}`, now, SECRET)
    ).toBeNull()
    expect(
      verifyPreviewToken(`user-1.${Number(expires) + 60}.${sig}`, now, SECRET)
    ).toBeNull()
    expect(
      verifyPreviewToken(
        token,
        now,
        "other-secret-0123456789abcdef0123456789ab"
      )
    ).toBeNull()
    for (const bad of [undefined, "", "a.b", "a.b.c.d", "user-1.x.sig"])
      expect(verifyPreviewToken(bad, now, SECRET)).toBeNull()
  })
})

describe("assertPreviewAccess (draft content only for the signed-in previewer)", () => {
  it("does nothing outside draft mode", async () => {
    await expect(assertPreviewAccess()).resolves.toBeUndefined()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("allows draft mode with a valid cookie for the signed-in user", async () => {
    draft.isEnabled = true
    jar.set(PREVIEW_COOKIE, signPreviewToken("user-1"))
    session.current = { actor: { userId: "user-1", roles: ["editor"] } }
    await expect(assertPreviewAccess()).resolves.toBeUndefined()
    await expect(isPreviewing()).resolves.toBe(true)
  })

  it("isPreviewing is false outside draft mode, even with a valid cookie", async () => {
    jar.set(PREVIEW_COOKIE, signPreviewToken("user-1"))
    session.current = { actor: { userId: "user-1", roles: ["editor"] } }
    await expect(isPreviewing()).resolves.toBe(false)
  })

  it.each([
    ["no preview cookie", null, "user-1", ["editor"]],
    ["no session (signed out)", "user-1", null, ["editor"]],
    ["cookie of another user", "user-2", "user-1", ["editor"]],
    [
      "a user demoted to a role without read access",
      "user-1",
      "user-1",
      ["intake"],
    ],
  ])("exits preview with %s", async (_case, cookieUser, sessionUser, roles) => {
    draft.isEnabled = true
    if (cookieUser) jar.set(PREVIEW_COOKIE, signPreviewToken(cookieUser))
    session.current = sessionUser
      ? { actor: { userId: sessionUser, roles } }
      : null
    await expect(isPreviewing()).resolves.toBe(false)
    await expect(assertPreviewAccess()).rejects.toThrow(
      "NEXT_REDIRECT /api/v1/preview/exit"
    )
  })

  it("exits preview with an expired cookie", async () => {
    draft.isEnabled = true
    const issued = Date.now() - (PREVIEW_TTL_SECONDS + 1) * 1000
    jar.set(PREVIEW_COOKIE, signPreviewToken("user-1", issued))
    session.current = { actor: { userId: "user-1", roles: ["editor"] } }
    await expect(assertPreviewAccess()).rejects.toThrow(
      "NEXT_REDIRECT /api/v1/preview/exit"
    )
  })
})

describe("assertPreviewAccess (exit returns to the page)", () => {
  it("passes the page proxy.ts saw to the exit route", async () => {
    draft.isEnabled = true
    requestHeaders.set(REQUEST_PATH_HEADER, "/terms?x=1")
    // A document request redirects over HTTP (blocking metadata): no Referer
    // names the page, so the exit route gets it as ?to.
    await expect(assertPreviewAccess()).rejects.toThrow(
      "NEXT_REDIRECT /api/v1/preview/exit?to=%2Fterms%3Fx%3D1"
    )
  })

  it("without the header the exit route falls back to the Referer", async () => {
    draft.isEnabled = true
    await expect(assertPreviewAccess()).rejects.toThrow(
      /^NEXT_REDIRECT \/api\/v1\/preview\/exit$/
    )
  })
})

describe("previewCookieOptions", () => {
  it("is HttpOnly, Lax, Path=/ and not Secure on http", () => {
    expect(previewCookieOptions()).toEqual({
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    })
  })

  it("is Secure when BETTER_AUTH_URL is https", () => {
    process.env.BETTER_AUTH_URL = "https://security-partners.example"
    expect(previewCookieOptions()).toMatchObject({ path: "/", secure: true })
  })
})

describe("safeReturnPath", () => {
  const origin = "http://localhost:3000"
  it.each([
    ["http://localhost:3000/about?x=1", "/about?x=1"],
    ["http://localhost:3000/", "/"],
    ["https://evil.example/about", "/"],
    ["http://localhost:3000/admin/pages", "/"],
    ["http://localhost:3000//evil.example/x", "/"],
    ["http://localhost:3000/\\evil.example/x", "/"],
    ["not a url", "/"],
    [undefined, "/"],
  ])("%s → %s", (referer, expected) => {
    expect(safeReturnPath(referer, origin)).toBe(expected)
  })
})

describe("canPreview (unlocks every draft site-wide)", () => {
  // canPreview also accepts appearance:read (C5). Draft mode is site-wide,
  // so that clause is only safe while every appearance reader can already
  // preview page drafts. A role with appearance alone must be a deliberate
  // choice: change canPreview (or this pin) when one is added.
  it.each(ROLES)(
    "%s: appearance:read implies page:read (no widening)",
    (role) => {
      if (hasPermission([role], { appearance: ["read"] })) {
        expect(hasPermission([role], { page: ["read"] })).toBe(true)
      }
    }
  )

  it("matches the role matrix", () => {
    const previewers = ROLES.filter((role) => canPreview([role]))
    expect(previewers).toEqual(
      ROLES.filter((role) =>
        (["page", "service", "article", "settings"] as const).some(
          (r) => ROLE_GRANTS[role][r]?.includes("read" as never) ?? false
        )
      )
    )
  })
})
