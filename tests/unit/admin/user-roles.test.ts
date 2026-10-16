import { describe, expect, it } from "vitest"

import {
  assignableRoles,
  managesOwners,
  mayManageUser,
  roleLabels,
  STATUS_INFO,
} from "@/lib/admin/user-roles"
import { ROLES } from "@/lib/auth/roles"

describe("owner rules in the users UI (mirror of the users service)", () => {
  it("only owners may grant the owner role", () => {
    expect(assignableRoles(["owner"])).toEqual([...ROLES])
    expect(assignableRoles(["admin"])).toEqual([
      "admin",
      "editor",
      "author",
      "marketer",
      "intake",
      "viewer",
    ])
    expect(managesOwners(["owner", "viewer"])).toBe(true)
    expect(managesOwners(["admin"])).toBe(false)
  })

  it("only owners may manage owner accounts", () => {
    expect(mayManageUser(["admin"], ["owner", "editor"])).toBe(false)
    expect(mayManageUser(["admin"], ["admin"])).toBe(true)
    expect(mayManageUser(["owner"], ["owner"])).toBe(true)
  })

  it("lists roles in matrix order", () => {
    expect(roleLabels(["viewer", "owner", "editor"])).toBe(
      "Owner, Editor, Viewer"
    )
  })

  it("maps statuses to kit pill tones", () => {
    expect(STATUS_INFO.active).toEqual({ label: "Active", tone: "success" })
    expect(STATUS_INFO.invited).toEqual({ label: "Invited", tone: "info" })
    expect(STATUS_INFO.banned).toEqual({ label: "Banned", tone: "danger" })
  })
})
