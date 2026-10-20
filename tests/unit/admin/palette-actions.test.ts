import { describe, expect, it, vi } from "vitest"

import {
  buildActions,
  matchesQuery,
} from "@/components/admin/shell/palette-actions"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"

function actionsFor(
  roles: Role[],
  state: { theme?: string; signingOut?: boolean } = {}
) {
  const input = {
    setTheme: vi.fn(),
    signOut: vi.fn(),
    signingOut: state.signingOut ?? false,
    theme: state.theme,
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
      "new-page",
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

  it("leaves out the action for the active theme", () => {
    const themes = (theme?: string) =>
      actionsFor(["owner"], { theme })
        .actions.map((a) => a.id)
        .filter((id) => id.startsWith("theme-"))
    expect(themes("light")).toEqual(["theme-dark", "theme-system"])
    expect(themes("dark")).toEqual(["theme-light", "theme-system"])
    expect(themes("system")).toEqual(["theme-light", "theme-dark"])
    // Unknown (next-themes not mounted yet): all three.
    expect(themes(undefined)).toEqual([
      "theme-light",
      "theme-dark",
      "theme-system",
    ])
  })

  it("disables Sign out (only) while a sign-out is pending", () => {
    const disabled = (signingOut: boolean) =>
      actionsFor(["owner"], { signingOut })
        .actions.filter((a) => a.disabled)
        .map((a) => a.id)
    expect(disabled(true)).toEqual(["sign-out"])
    expect(disabled(false)).toEqual([])
  })

  it("gives every action keywords", () => {
    for (const action of actionsFor(["owner"]).actions)
      expect(action.keywords.length).toBeGreaterThan(0)
  })
})
