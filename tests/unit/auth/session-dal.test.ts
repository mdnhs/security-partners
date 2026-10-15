import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  cookie: "" as string,
  session: null as unknown,
  getSession: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      cookie: state.cookie,
      "x-forwarded-for": "203.0.113.9",
      "user-agent": "dal-test",
    }),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  },
  forbidden: () => {
    throw new Error("NEXT_FORBIDDEN")
  },
}))

vi.mock("@/server/auth/auth", () => ({
  getAuth: () => ({ api: { getSession: state.getSession } }),
}))

import {
  getActor,
  requireActor,
  requirePermission,
} from "@/server/auth/session"

const USER_ID = "0190a6e0-0000-7000-8000-0000000000aa"

function sessionFor(user: Record<string, unknown>, impersonatedBy?: string) {
  return {
    user: {
      id: USER_ID,
      name: "Test",
      email: "t@example.test",
      title: null,
      twoFactorEnabled: false,
      banned: false,
      banExpires: null,
      role: "viewer",
      ...user,
    },
    session: {
      id: "0190a6e0-0000-7000-8000-0000000000bb",
      expiresAt: new Date(Date.now() + 3_600_000),
      impersonatedBy: impersonatedBy ?? null,
    },
  }
}

beforeEach(() => {
  state.cookie = "sp.session_token=abc.def"
  state.session = null
  state.getSession.mockReset()
  state.getSession.mockImplementation(async () => state.session)
})

describe("session DAL", () => {
  it("returns null without a session cookie and never calls Better Auth", async () => {
    state.cookie = ""
    expect(await getActor()).toBeNull()
    expect(state.getSession).not.toHaveBeenCalled()
  })

  it("reads the session fresh (cookie cache disabled) and builds the actor", async () => {
    state.session = sessionFor(
      { role: "editor,author,bogus" },
      "0190a6e0-0000-7000-8000-0000000000cc"
    )
    expect(await getActor()).toEqual({
      userId: USER_ID,
      roles: ["editor", "author"],
      ip: "203.0.113.9",
      userAgent: "dal-test",
      impersonatorId: "0190a6e0-0000-7000-8000-0000000000cc",
    })
    expect(state.getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableCookieCache: true } })
    )
  })

  it("accepts the __Secure- cookie name used over https", async () => {
    state.cookie = "__Secure-sp.session_token=abc.def"
    state.session = sessionFor({})
    expect((await getActor())?.userId).toBe(USER_ID)
  })

  it("treats a banned user as signed out (until the ban expires)", async () => {
    state.session = sessionFor({ banned: true })
    expect(await getActor()).toBeNull()
    state.session = sessionFor({
      banned: true,
      banExpires: new Date(Date.now() - 1000),
    })
    expect(await getActor()).not.toBeNull()
  })

  it("requireActor redirects to /admin/sign-in without a session", async () => {
    await expect(requireActor()).rejects.toThrow("NEXT_REDIRECT /admin/sign-in")
  })

  it("requirePermission → forbidden() when the roles lack the permission", async () => {
    state.session = sessionFor({ role: "editor" })
    await expect(requirePermission({ lead: ["read"] })).rejects.toThrow(
      "NEXT_FORBIDDEN"
    )
    state.session = sessionFor({ role: "intake" })
    expect((await requirePermission({ lead: ["read"] })).roles).toEqual([
      "intake",
    ])
  })
})
