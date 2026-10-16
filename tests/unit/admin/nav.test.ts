import { describe, expect, it } from "vitest"

import {
  dockItems,
  findNavItem,
  isActiveItem,
  menuSections,
  NAV_SECTIONS,
  navDestinations,
  navItems,
} from "@/components/admin/shell/nav"
import type { Role } from "@/lib/auth/roles"

const menu = (roles: Role[]) =>
  menuSections(roles).flatMap((section) => section.items.map((i) => i.label))
const dock = (roles: Role[]) => dockItems(roles).map((i) => i.label)
const destinations = (roles: Role[]) =>
  navDestinations(roles).map((d) => d.label)

const MENU_ALL = ["Dashboard", "Pages", "Services", "Collections", "Settings"]
const DEST_ALL = [
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

describe("navigation registry (JW structure)", () => {
  it.each<[Role, string[]]>([
    ["owner", MENU_ALL],
    ["admin", MENU_ALL],
    ["editor", MENU_ALL],
    ["viewer", MENU_ALL],
    ["marketer", ["Dashboard", "Pages", "Services"]],
    ["author", ["Dashboard"]],
    ["intake", ["Dashboard"]],
  ])("%s sees menu %j", (role, expected) => {
    expect(menu([role])).toEqual(expected)
  })

  it("lists sections only; sub-pages are children", () => {
    const collections = menuSections(["editor"])
      .flatMap((s) => s.items)
      .find((i) => i.label === "Collections")!
    expect(collections.children!.map((c) => c.label)).toEqual([
      "Team",
      "Clients",
      "Group companies",
      "Categories",
    ])
    expect(collections.href).toBe("/admin/team")
  })

  it("keeps Account out of the menu and in the dock", () => {
    expect(menu(["intake"])).not.toContain("Account")
    expect(dock(["intake"])).toEqual(["Account"])
    expect(menuSections(["intake"]).map((s) => s.label)).toEqual(["Overview"])
  })

  it("flattens children for ⌘K, permission-filtered", () => {
    expect(destinations(["editor"])).toEqual(DEST_ALL)
    expect(destinations(["marketer"])).toEqual([
      "Dashboard",
      "Pages",
      "Services",
      "Account",
    ])
    const team = navDestinations(["editor"]).find((d) => d.label === "Team")!
    expect(team).toMatchObject({ href: "/admin/team", parent: "Collections" })
  })

  it("finds Collections by its stable id, not its label", () => {
    expect(findNavItem(["editor"], "collections")?.label).toBe("Collections")
    expect(findNavItem(["author"], "collections")).toBeUndefined()
  })

  it("gives ⌘K one entry per page, collection pages with their own icons", () => {
    const all = navDestinations(["owner"])
    expect(new Set(all.map((d) => d.href)).size).toBe(all.length)
    const icons = all
      .filter((d) => d.parent === "Collections")
      .map((d) => d.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })

  it("drops a parent whose children are all hidden", () => {
    expect(
      navItems(["author"])
        .flatMap((s) => s.items)
        .map((i) => i.label)
    ).not.toContain("Collections")
  })

  it("marks a parent active on any child's page", () => {
    const collections = NAV_SECTIONS.flatMap((s) => s.items).find(
      (i) => i.label === "Collections"
    )!
    expect(isActiveItem(collections, "/admin/clients")).toBe(true)
    expect(isActiveItem(collections, "/admin/group-companies/x")).toBe(true)
    expect(isActiveItem(collections, "/admin/services")).toBe(false)
    const dashboard = NAV_SECTIONS[0]!.items[0]!
    expect(isActiveItem(dashboard, "/admin")).toBe(true)
    expect(isActiveItem(dashboard, "/admin/pages")).toBe(false)
  })

  it("every link stays inside /admin", () => {
    for (const section of NAV_SECTIONS)
      for (const item of section.items) {
        expect(item.href.startsWith("/admin")).toBe(true)
        for (const child of item.children ?? [])
          expect(child.href.startsWith("/admin/")).toBe(true)
      }
  })
})
