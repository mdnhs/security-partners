import { describe, expect, it, vi } from "vitest"

import {
  buildActions,
  matchesQuery,
} from "@/components/admin/shell/palette-actions"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"

function actionsFor(roles: Role[]) {
  const input = {
    setTheme: vi.fn(),
    signOut: vi.fn(),
    open: vi.fn(),
    navigate: vi.fn(),
    can: (p: PermissionRequest) => hasPermission(roles, p),
  }
  return { input, actions: buildActions(input) }
}

describe("matchesQuery", () => {
  it("is case-insensitive; every word must hit the label or a keyword", () => {
    expect(matchesQuery("", "Sign out")).toBe(true)
    expect(matchesQuery("  ", "Sign out")).toBe(true)
    expect(matchesQuery("SIGN", "Sign out")).toBe(true)
    expect(matchesQuery("sign out", "Sign out")).toBe(true)
    expect(matchesQuery("log", "Sign out", ["log out"])).toBe(true)
    expect(matchesQuery("dark mode", "Switch to dark theme", ["mode"])).toBe(
      true
    )
    expect(matchesQuery("dark night", "Switch to light theme", ["mode"])).toBe(
      false
    )
    expect(matchesQuery("sign in", "Sign out")).toBe(false)
  })
})

describe("buildActions", () => {
  it("lists the MK actions in order for an owner", () => {
    expect(actionsFor(["owner"]).actions.map((a) => a.id)).toEqual([
      "new-article",
      "new-service",
      "open-site",
      "theme-light",
      "theme-dark",
      "theme-system",
      "sign-out",
    ])
  })

  it("omits create actions the role lacks", () => {
    expect(actionsFor(["intake"]).actions.map((a) => a.id)).toEqual([
      "open-site",
      "theme-light",
      "theme-dark",
      "theme-system",
      "sign-out",
    ])
  })

  it("runs through the given callbacks", () => {
    const { input, actions } = actionsFor(["owner"])
    const run = (id: string) => actions.find((a) => a.id === id)!.run()
    run("new-article")
    run("new-service")
    run("open-site")
    run("theme-light")
    run("theme-dark")
    run("theme-system")
    run("sign-out")
    expect(input.navigate.mock.calls).toEqual([
      ["/admin/insights/new"],
      ["/admin/services/new"],
    ])
    expect(input.open).toHaveBeenCalledWith("/")
    expect(input.setTheme.mock.calls).toEqual([["light"], ["dark"], ["system"]])
    expect(input.signOut).toHaveBeenCalledOnce()
  })

  it("gives every action keywords", () => {
    for (const action of actionsFor(["owner"]).actions)
      expect(action.keywords.length).toBeGreaterThan(0)
  })
})
