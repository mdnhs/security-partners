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

const MENU_ALL = [
  "Dashboard",
  "Pages",
  "Articles",
  "Services",
  "Collections",
  "Media",
  "Settings",
]
// Phase 8: Growth › Marketing for roles holding marketing:read (not editors).
const MENU_MARKETING = [
  "Dashboard",
  "Pages",
  "Articles",
  "Services",
  "Collections",
  "Media",
  "Marketing",
  "Settings",
]
const DEST_ALL = [
  "Dashboard",
  "Pages",
  "Articles",
  "Services",
  "Team",
  "Clients",
  "Group companies",
  "Categories",
  "Media",
  "Settings",
  "Account",
]
const DEST_ADMIN = [
  "Dashboard",
  "Pages",
  "Articles",
  "Services",
  "Team",
  "Clients",
  "Group companies",
  "Categories",
  "Media",
  "Tracking",
  "Consent banner",
  "Settings",
  "Users",
  "Audit log",
  "Account",
]

describe("navigation registry (JW structure)", () => {
  it.each<[Role, string[]]>([
    ["owner", MENU_MARKETING],
    ["admin", MENU_MARKETING],
    ["editor", MENU_ALL],
    ["viewer", MENU_MARKETING],
    [
      "marketer",
      ["Dashboard", "Pages", "Articles", "Services", "Media", "Marketing"],
    ],
    ["author", ["Dashboard", "Articles", "Media"]],
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

  it("Users and Audit log are dock items for owners and admins only (spec §8.1, ruling D3)", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(dock([role])).toEqual(["Users", "Audit log", "Account"])
      expect(menu([role])).toEqual(MENU_MARKETING)
    }
    for (const role of ["editor", "viewer", "marketer", "author"] as const)
      expect(dock([role])).toEqual(["Account"])
    const admin = navItems(["admin"]).find((s) => s.label === "Administration")
    expect(admin?.items.map((i) => [i.label, i.href])).toEqual([
      ["Users", "/admin/users"],
      ["Audit log", "/admin/audit"],
    ])
    expect(navItems(["editor"]).some((s) => s.label === "Administration")).toBe(
      false
    )
  })

  it("flattens children for ⌘K, permission-filtered", () => {
    expect(destinations(["editor"])).toEqual(DEST_ALL)
    expect(destinations(["admin"])).toEqual(DEST_ADMIN)
    expect(destinations(["marketer"])).toEqual([
      "Dashboard",
      "Pages",
      "Articles",
      "Services",
      "Media",
      "Tracking",
      "Consent banner",
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
    const users = NAV_SECTIONS.flatMap((s) => s.items).find(
      (i) => i.label === "Users"
    )!
    expect(
      isActiveItem(users, "/admin/users/0190f0e0-0000-7000-8000-000000000001")
    ).toBe(true)
    expect(isActiveItem(users, "/admin/users-archive")).toBe(false)
  })

  it("Articles sits right after Pages in Content (spec §8.1)", () => {
    const content = NAV_SECTIONS.find((s) => s.label === "Content")!
    expect(content.items.slice(0, 2).map((i) => [i.label, i.href])).toEqual([
      ["Pages", "/admin/pages"],
      ["Articles", "/admin/articles"],
    ])
    expect(menu(["intake"])).not.toContain("Articles")
    expect(destinations(["intake"])).not.toContain("Articles")
  })

  it("Media is the last item of Content (master 6.3)", () => {
    const content = NAV_SECTIONS.find((s) => s.label === "Content")!
    expect(content.items.at(-1)).toMatchObject({
      label: "Media",
      href: "/admin/media",
      permission: { media: ["read"] },
      match: "prefix",
    })
    expect(menu(["intake"])).not.toContain("Media")
    expect(destinations(["intake"])).not.toContain("Media")
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

describe("Growth › Marketing (phase 8)", () => {
  const marketing = (roles: Role[]) =>
    menuSections(roles)
      .find((s) => s.label === "Growth")
      ?.items.filter((i) => i.label === "Marketing")
      .map((i) => [i.label, i.children?.map((c) => c.label)]) ?? null
  const MARKETING = [["Marketing", ["Tracking", "Consent banner"]]]

  it.each<[Role, unknown]>([
    ["owner", [["Marketing", ["Tracking", "Consent banner", "Custom code"]]]],
    ["admin", MARKETING],
    ["marketer", MARKETING],
    ["viewer", MARKETING],
    ["editor", null],
    ["author", null],
    ["intake", null],
  ])("%s sees %j", (role, expected) => {
    expect(marketing([role])).toEqual(expected)
  })

  it("Growth sits between Content and Configuration", () => {
    const labels = menuSections(["owner"]).map((s) => s.label)
    expect(labels.indexOf("Growth")).toBe(labels.indexOf("Content") + 1)
    expect(labels.indexOf("Configuration")).toBe(labels.indexOf("Growth") + 1)
  })

  it("Marketing opens its first tab; ⌘K lists sub-pages with their parent", () => {
    const item = navItems(["marketer"])
      .flatMap((s) => s.items)
      .find((i) => i.label === "Marketing")!
    expect(item.href).toBe("/admin/marketing/tracking")
    expect(
      navDestinations(["owner"])
        .filter((d) => d.parent === "Marketing")
        .map((d) => `${d.parent} › ${d.label}`)
    ).toEqual([
      "Marketing › Tracking",
      "Marketing › Consent banner",
      "Marketing › Custom code",
    ])
    const raw = NAV_SECTIONS.flatMap((s) => s.items).find(
      (i) => i.label === "Marketing"
    )!
    expect(isActiveItem(raw, "/admin/marketing/custom-code")).toBe(true)
  })
})
