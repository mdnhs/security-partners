import { describe, expect, it } from "vitest"

import { hasPermission } from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"
import { exportPermission } from "@/lib/newsletter/export"

describe("newsletter export scope (shared by the API and the admin UI)", () => {
  it("confirmed: newsletter:export; all: also newsletter:delete", () => {
    expect(exportPermission("confirmed")).toEqual({ newsletter: ["export"] })
    expect(exportPermission("all")).toEqual({
      newsletter: ["export", "delete"],
    })
  })

  it("only owner and admin may export every status", () => {
    expect(
      ROLES.filter((role) => hasPermission([role], exportPermission("all")))
    ).toEqual(["owner", "admin"])
    expect(
      ROLES.filter((role) =>
        hasPermission([role], exportPermission("confirmed"))
      )
    ).toEqual(["owner", "admin", "marketer"])
  })
})
