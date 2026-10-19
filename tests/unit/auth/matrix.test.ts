import { describe, expect, it } from "vitest"

import {
  ACTION_LABELS,
  permissionMatrix,
  RESOURCE_LABELS,
} from "@/lib/auth/matrix"
import {
  hasPermission,
  statements,
  type Resource,
} from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"

const row = (resource: string, action: string) =>
  permissionMatrix().find((r) => r.resource === resource && r.action === action)

describe("permission matrix (generated from lib/auth/permissions)", () => {
  it("customCode.update is allowed for owner only", () => {
    expect(row("customCode", "update")?.cells).toEqual({
      owner: "yes",
      admin: "no",
      editor: "no",
      author: "no",
      marketer: "no",
      intake: "no",
      viewer: "no",
    })
  })

  it("article.update and article.delete are own-only for authors", () => {
    expect(row("article", "update")?.cells.author).toBe("own")
    expect(row("article", "delete")?.cells.author).toBe("own")
    // Roles holding updateAny/deleteAny are plain "yes".
    expect(row("article", "update")?.cells.editor).toBe("yes")
    expect(row("article", "delete")?.cells.admin).toBe("yes")
    // maySubmit (articles policy): without updateAny, own drafts only.
    expect(row("article", "submit")?.cells.author).toBe("own")
    expect(row("article", "submit")?.cells.editor).toBe("yes")
    // Own-only never applies to an action the role lacks.
    expect(row("article", "update")?.cells.viewer).toBe("no")
  })

  it("has exactly one row per statement action, in statement order", () => {
    const expected = Object.entries(statements).flatMap(([resource, actions]) =>
      actions.map((action) => `${resource}.${action}`)
    )
    expect(permissionMatrix().map((r) => `${r.resource}.${r.action}`)).toEqual(
      expected
    )
  })

  it("agrees with hasPermission for every cell (single source of truth)", () => {
    for (const r of permissionMatrix())
      for (const role of ROLES)
        expect(r.cells[role] !== "no").toBe(
          hasPermission([role], { [r.resource]: [r.action] })
        )
  })

  it("labels every resource and action", () => {
    for (const resource of Object.keys(statements) as Resource[]) {
      expect(RESOURCE_LABELS[resource]).toBeTruthy()
      for (const action of statements[resource])
        expect(ACTION_LABELS[action]).toBeTruthy()
    }
  })
})
