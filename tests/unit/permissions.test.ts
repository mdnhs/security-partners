import { describe, expect, it } from "vitest"

import {
  hasPermission,
  parseRoles,
  type PermissionRequest,
  type Resource,
  statements,
} from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"

// Spec §6.1 written out literally: every "resource:action" each role holds.
// Anything not listed must be denied.
const EXPECTED: Record<Role, string[]> = {
  owner: [
    "page:read",
    "page:create",
    "page:update",
    "page:publish",
    "page:delete",
    "service:read",
    "service:create",
    "service:update",
    "service:publish",
    "service:delete",
    "article:read",
    "article:create",
    "article:update",
    "article:publish",
    "article:delete",
    "article:submit",
    "article:updateAny",
    "article:deleteAny",
    "collection:read",
    "collection:create",
    "collection:update",
    "collection:delete",
    "media:read",
    "media:create",
    "media:update",
    "media:delete",
    "lead:read",
    "lead:update",
    "lead:delete",
    "lead:export",
    "seo:read",
    "seo:update",
    "redirect:read",
    "redirect:create",
    "redirect:update",
    "redirect:delete",
    "marketing:read",
    "marketing:update",
    "customCode:read",
    "customCode:update",
    "settings:read",
    "settings:update",
    "integration:read",
    "integration:update",
    "integration:test",
    "user:read",
    "user:invite",
    "user:update",
    "user:ban",
    "user:impersonate",
    "user:revokeSessions",
    "owner:manage",
    "audit:read",
    "ai:use",
    "appearance:read",
    "appearance:update",
    "appearance:publish",
    "newsletter:read",
    "newsletter:export",
    "newsletter:delete",
  ],
  admin: [
    "page:read",
    "page:create",
    "page:update",
    "page:publish",
    "page:delete",
    "service:read",
    "service:create",
    "service:update",
    "service:publish",
    "service:delete",
    "article:read",
    "article:create",
    "article:update",
    "article:publish",
    "article:delete",
    "article:submit",
    "article:updateAny",
    "article:deleteAny",
    "collection:read",
    "collection:create",
    "collection:update",
    "collection:delete",
    "media:read",
    "media:create",
    "media:update",
    "media:delete",
    "lead:read",
    "lead:update",
    "lead:delete",
    "lead:export",
    "seo:read",
    "seo:update",
    "redirect:read",
    "redirect:create",
    "redirect:update",
    "redirect:delete",
    "marketing:read",
    "marketing:update",
    "settings:read",
    "settings:update",
    "integration:read",
    "integration:update",
    "integration:test",
    "user:read",
    "user:invite",
    "user:update",
    "user:ban",
    "user:impersonate",
    "user:revokeSessions",
    "audit:read",
    "ai:use",
    "appearance:read",
    "appearance:update",
    "appearance:publish",
    "newsletter:read",
    "newsletter:export",
    "newsletter:delete",
  ],
  editor: [
    "page:read",
    "page:create",
    "page:update",
    "page:publish",
    "page:delete",
    "service:read",
    "service:create",
    "service:update",
    "service:publish",
    "service:delete",
    "article:read",
    "article:create",
    "article:update",
    "article:publish",
    "article:delete",
    "article:submit",
    "article:updateAny",
    "article:deleteAny",
    "collection:read",
    "collection:create",
    "collection:update",
    "collection:delete",
    "media:read",
    "media:create",
    "media:update",
    "media:delete",
    "seo:read",
    "seo:update",
    "settings:read",
    "settings:update",
    "ai:use",
    "appearance:read",
  ],
  author: [
    "article:read",
    "article:create",
    "article:update",
    "article:delete",
    "article:submit",
    "media:read",
    "media:create",
    "ai:use",
  ],
  marketer: [
    "page:read",
    "service:read",
    "article:read",
    "media:read",
    "media:create",
    "seo:read",
    "seo:update",
    "redirect:read",
    "redirect:create",
    "redirect:update",
    "redirect:delete",
    "marketing:read",
    "marketing:update",
    "ai:use",
    "appearance:read",
    "newsletter:read",
    "newsletter:export",
  ],
  intake: ["lead:read", "lead:update", "lead:export", "ai:use"],
  viewer: [
    "page:read",
    "service:read",
    "article:read",
    "collection:read",
    "media:read",
    "seo:read",
    "redirect:read",
    "marketing:read",
    "settings:read",
    "appearance:read",
  ],
}

const ALL_PAIRS = (Object.keys(statements) as Resource[]).flatMap((resource) =>
  statements[resource].map((action) => [resource, action] as const)
)

const req = (resource: Resource, action: string) =>
  ({ [resource]: [action] }) as PermissionRequest

describe("permission matrix (spec §6.1): every role × resource × action", () => {
  it("covers 17 resources and 57 actions", () => {
    expect(Object.keys(statements)).toHaveLength(17)
    expect(ALL_PAIRS).toHaveLength(57)
  })

  it("page:create/delete (builder pages, D5.2) go to owner, admin, editor only", () => {
    const holders = (action: string) =>
      ROLES.filter((role) => hasPermission([role], req("page", action)))
    expect(holders("create")).toEqual(["owner", "admin", "editor"])
    expect(holders("delete")).toEqual(["owner", "admin", "editor"])
    expect(holders("read")).toEqual([
      "owner",
      "admin",
      "editor",
      "marketer",
      "viewer",
    ])
  })

  for (const role of ROLES) {
    describe(role, () => {
      it.each(ALL_PAIRS)("%s:%s", (resource, action) => {
        expect(hasPermission([role], req(resource, action))).toBe(
          EXPECTED[role].includes(`${resource}:${action}`)
        )
      })
    })
  }

  it("expected lists only name real statements", () => {
    const real = new Set(ALL_PAIRS.map(([r, a]) => `${r}:${a}`))
    for (const role of ROLES)
      for (const pair of EXPECTED[role]) expect(real.has(pair)).toBe(true)
  })
})

describe("hasPermission", () => {
  it("multi-role users get the union across roles", () => {
    const both: Role[] = ["intake", "author"]
    expect(hasPermission(both, { lead: ["export"] })).toBe(true)
    expect(hasPermission(both, { article: ["submit"] })).toBe(true)
    // one request spanning resources granted by different roles
    expect(hasPermission(both, { lead: ["read"], article: ["create"] })).toBe(
      true
    )
    expect(
      hasPermission(["intake"], { lead: ["read"], article: ["create"] })
    ).toBe(false)
  })

  it("requires every requested action", () => {
    expect(hasPermission(["author"], { article: ["create", "publish"] })).toBe(
      false
    )
    expect(hasPermission(["editor"], { article: ["create", "publish"] })).toBe(
      true
    )
  })

  it("unknown roles grant nothing (incl. prototype keys)", () => {
    for (const bogus of [
      "superuser",
      "user",
      "constructor",
      "__proto__",
      "",
      "Owner",
    ])
      expect(hasPermission([bogus], { page: ["read"] })).toBe(false)
    expect(hasPermission([], { page: ["read"] })).toBe(false)
  })

  it("denies empty requests and empty action lists", () => {
    expect(hasPermission(["owner"], {})).toBe(false)
    expect(hasPermission(["owner"], { page: [] })).toBe(false)
  })

  it("owner:manage is owner-only", () => {
    for (const role of ROLES)
      expect(hasPermission([role], { owner: ["manage"] })).toBe(
        role === "owner"
      )
  })

  it("newsletter: owner/admin all; marketer read+export; nobody else", () => {
    for (const role of ROLES) {
      const full = role === "owner" || role === "admin"
      const read = full || role === "marketer"
      expect(hasPermission([role], { newsletter: ["read"] })).toBe(read)
      expect(hasPermission([role], { newsletter: ["export"] })).toBe(read)
      expect(hasPermission([role], { newsletter: ["delete"] })).toBe(full)
    }
  })

  it("customCode (read and update) is owner-only", () => {
    for (const role of ROLES) {
      expect(hasPermission([role], { customCode: ["read"] })).toBe(
        role === "owner"
      )
      expect(hasPermission([role], { customCode: ["update"] })).toBe(
        role === "owner"
      )
    }
  })
})

describe("hasPermission never throws on malformed requests (fail closed)", () => {
  it("denies a resource whose action list is not an array", () => {
    expect(
      hasPermission(["owner"], {
        page: undefined,
      } as unknown as PermissionRequest)
    ).toBe(false)
    expect(
      hasPermission(["owner"], { page: "read" } as unknown as PermissionRequest)
    ).toBe(false)
  })

  it("denies prototype-named resources", () => {
    for (const name of [
      "__proto__",
      "constructor",
      "toString",
      "hasOwnProperty",
    ])
      expect(
        hasPermission(
          ["owner"],
          JSON.parse(`{"${name}":["read"]}`) as PermissionRequest
        )
      ).toBe(false)
  })
})

describe("parseRoles", () => {
  it("splits the comma-joined Better Auth role column", () => {
    expect(parseRoles("editor,author")).toEqual(["editor", "author"])
    expect(parseRoles(" owner , viewer ")).toEqual(["owner", "viewer"])
  })

  it("drops unknown names and duplicates; null/empty → []", () => {
    expect(parseRoles("user,admin,admin,superuser")).toEqual(["admin"])
    expect(parseRoles(null)).toEqual([])
    expect(parseRoles(undefined)).toEqual([])
    expect(parseRoles("")).toEqual([])
  })
})
