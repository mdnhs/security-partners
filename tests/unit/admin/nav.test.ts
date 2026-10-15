import { describe, expect, it } from "vitest"

import type { Role } from "@/lib/auth/roles"
import {
  isActiveItem,
  NAV_SECTIONS,
  navItems,
} from "@/components/admin/shell/nav"

const labels = (roles: Role[]) =>
  navItems(roles).flatMap((section) => section.items.map((i) => i.label))

const ALL = [
  "Dashboard",
  "Pages",
  "Services",
  "Team",
  "Clients",
  "Group companies",
  "Categories",
  "Settings",
  "Account",
]

describe("navItems(roles) — sidebar filtered by read permission (master 4.1)", () => {
  it.each<[Role, string[]]>([
    ["owner", ALL],
    ["admin", ALL],
    ["editor", ALL],
    ["viewer", ALL],
    ["marketer", ["Dashboard", "Pages", "Services", "Account"]],
    ["author", ["Dashboard", "Account"]],
    ["intake", ["Dashboard", "Account"]],
  ])("%s sees %j", (role, expected) => {
    expect(labels([role])).toEqual(expected)
  })

  it("unions multiple roles and drops empty sections", () => {
    expect(labels(["author", "marketer"])).toEqual([
      "Dashboard",
      "Pages",
      "Services",
      "Account",
    ])
    expect(navItems(["intake"]).map((s) => s.label)).toEqual([
      "Overview",
      "You",
    ])
  })

  it("unknown roles see only the items without a permission", () => {
    expect(labels(["nope" as Role])).toEqual(["Dashboard", "Account"])
  })

  it("every item links inside /admin", () => {
    for (const section of NAV_SECTIONS)
      for (const item of section.items)
        expect(item.href.startsWith("/admin")).toBe(true)
  })
})

describe("isActiveItem", () => {
  const [dashboard] = NAV_SECTIONS[0].items
  const pages = NAV_SECTIONS[1].items[0]

  it("matches the dashboard exactly", () => {
    expect(isActiveItem(dashboard, "/admin")).toBe(true)
    expect(isActiveItem(dashboard, "/admin/pages")).toBe(false)
  })

  it("matches a section and its sub-pages only", () => {
    expect(isActiveItem(pages, "/admin/pages")).toBe(true)
    expect(isActiveItem(pages, "/admin/pages/home")).toBe(true)
    expect(isActiveItem(pages, "/admin/pages-archive")).toBe(false)
  })
})
