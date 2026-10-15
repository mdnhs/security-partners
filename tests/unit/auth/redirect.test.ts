import { describe, expect, it } from "vitest"

import { isAdminAuthPath, safeNext } from "@/lib/auth/redirect"

describe("safeNext", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/users?page=2#top", "/admin/users?page=2#top"],
    ["/admin/account", "/admin/account"],
  ])("keeps admin path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })

  it.each([
    null,
    undefined,
    "",
    "https://evil.example/admin",
    "//evil.example/admin",
    "/\\evil.example",
    "/blog",
    "/administrator",
    "/admin/sign-in",
    "/admin/two-factor?next=/admin",
    "javascript:alert(1)",
  ])("falls back to /admin for %s", (input) => {
    expect(safeNext(input)).toBe("/admin")
  })
})

describe("isAdminAuthPath", () => {
  it("matches the five auth pages only", () => {
    expect(isAdminAuthPath("/admin/set-password")).toBe(true)
    expect(isAdminAuthPath("/admin/sign-in/")).toBe(true)
    expect(isAdminAuthPath("/admin")).toBe(false)
    expect(isAdminAuthPath("/admin/sign-in-later")).toBe(false)
  })

  it("matches the exact path or the path plus one trailing slash only", () => {
    expect(isAdminAuthPath("/admin/two-factor/")).toBe(true)
    expect(isAdminAuthPath("/admin/sign-in/anything")).toBe(false)
    expect(isAdminAuthPath("/admin/set-password/x/y")).toBe(false)
    expect(isAdminAuthPath("/admin/sign-in//")).toBe(false)
  })
})
