import { describe, expect, it } from "vitest"

import {
  CURRENT_ROUTES,
  dockItems,
  findNavItem,
  isActiveItem,
  menuSections,
  navDestinations,
} from "@/components/admin/shell/nav"
import {
  activeItem,
  dockLinks,
  firstVisibleChild,
  NAV_ITEMS,
  reachableLinks,
  visibleNav,
} from "@/lib/admin/nav"
import { ROLES, type Role } from "@/lib/auth/roles"

const menu = (roles: Role[]) =>
  visibleNav(roles).map((g) => [g.label, g.items.map((i) => i.label)])
const children = (roles: Role[], id: string) =>
  visibleNav(roles)
    .flatMap((g) => g.items)
    .find((i) => i.id === id)
    ?.children?.map((c) => c.label) ?? null
const item = (id: string) => NAV_ITEMS.find((i) => i.id === id)!

describe("role gating keeps the permission matrix (lib/auth/permissions.ts)", () => {
  it.each<[Role, unknown]>([
    [
      "owner",
      [
        [
          "Menu",
          [
            "Dashboard",
            "Pages",
            "Insights",
            "Services",
            "Collections",
            "Media",
            "Enquiries",
          ],
        ],
        ["Growth", ["SEO", "Marketing"]],
        ["General", ["Site settings"]],
      ],
    ],
    [
      "editor",
      [
        [
          "Menu",
          [
            "Dashboard",
            "Pages",
            "Insights",
            "Services",
            "Collections",
            "Media",
          ],
        ],
        ["Growth", ["SEO"]],
        ["General", ["Site settings"]],
      ],
    ],
    [
      "viewer",
      [
        [
          "Menu",
          [
            "Dashboard",
            "Pages",
            "Insights",
            "Services",
            "Collections",
            "Media",
          ],
        ],
        ["Growth", ["SEO", "Marketing"]],
        ["General", ["Site settings"]],
      ],
    ],
    [
      "marketer",
      [
        ["Menu", ["Dashboard", "Pages", "Insights", "Services", "Media"]],
        ["Growth", ["SEO", "Marketing"]],
      ],
    ],
    ["author", [["Menu", ["Dashboard", "Insights", "Media"]]]],
    ["intake", [["Menu", ["Dashboard", "Enquiries"]]]],
  ])("%s sees %j", (role, expected) => {
    expect(menu([role])).toEqual(expected)
  })

  it("admin's menu matches the owner's", () => {
    expect(menu(["admin"])).toEqual(menu(["owner"]))
  })

  it("filters children by their own permission", () => {
    expect(children(["owner"], "marketing")).toEqual([
      "Tracking",
      "Consent banner",
      "Custom code",
    ])
    // Custom code stays owner-only.
    for (const role of ["admin", "marketer", "viewer"] as const)
      expect(children([role], "marketing")).toEqual([
        "Tracking",
        "Consent banner",
      ])
    expect(children(["editor"], "seo")).toEqual(["Overview", "Defaults"])
    expect(children(["marketer"], "seo")).toEqual([
      "Overview",
      "Defaults",
      "Redirects",
    ])
    expect(children(["marketer"], "insights")).toEqual(["Articles"])
    expect(children(["viewer"], "insights")).toEqual(["Articles", "Categories"])
    expect(children(["owner"], "collections")).toEqual([
      "Team",
      "Clients",
      "Group companies",
    ])
    const settings = children(["editor"], "settings")!
    expect(settings).not.toContain("AI assistant")
    expect(settings).not.toContain("Integrations")
    expect(children(["admin"], "settings")).toEqual(
      expect.arrayContaining(["AI assistant", "Integrations"])
    )
  })

  it("dock: Users & roles and Activity log for owners/admins only", () => {
    expect(dockLinks(["admin"]).map((l) => l.id)).toEqual([
      "users",
      "activity",
      "help",
    ])
    for (const role of ["editor", "viewer", "marketer", "intake"] as const)
      expect(dockLinks([role]).map((l) => l.id)).toEqual(["help"])
    // Dock items never repeat in the menu.
    expect(
      visibleNav(["owner"])
        .flatMap((g) => g.items)
        .some((i) => i.dock)
    ).toBe(false)
  })

  it("⌘K: Design system for owners only; Account and Help for everyone", () => {
    expect(reachableLinks(["owner"]).map((l) => l.id)).toContain("design")
    for (const role of ROLES) {
      const ids = reachableLinks([role]).map((l) => l.id)
      expect(ids).toEqual(expect.arrayContaining(["account", "help"]))
      if (role !== "owner") expect(ids).not.toContain("design")
    }
  })

  it("⌘K lists sub-pages with their section, sections with children once", () => {
    const owner = reachableLinks(["owner"])
    expect(owner.find((l) => l.id === "seo-redirects")).toMatchObject({
      parent: "SEO",
      href: "/admin/seo/redirects",
    })
    expect(owner.find((l) => l.id === "leads")).toMatchObject({
      parent: null,
      label: "Enquiries",
    })
    expect(owner.some((l) => l.id === "seo")).toBe(false)
    for (const link of owner) expect(link.icon).toBeTruthy()
  })
})

describe("registry items (ported from the JW nav tests)", () => {
  it("Enquiries carries the new-leads badge and needs lead:read", () => {
    expect(item("leads")).toMatchObject({
      label: "Enquiries",
      href: "/admin/leads",
      permission: { lead: ["read"] },
      match: "prefix",
      badge: "new-leads",
    })
    for (const role of ["editor", "viewer", "marketer", "author"] as const)
      expect(menu([role]).flat(2)).not.toContain("Enquiries")
  })

  it("Media closes the Menu content items and needs media:read", () => {
    expect(item("media")).toMatchObject({
      href: "/admin/media",
      permission: { media: ["read"] },
    })
    expect(menu(["intake"]).flat(2)).not.toContain("Media")
  })

  it("drops a section whose children are all hidden", () => {
    expect(menu(["author"]).flat(2)).not.toContain("Collections")
    expect(menu(["intake"]).flat(2)).not.toContain("Site settings")
  })

  it("activeItem: /admin is exact; sub-pages and ids select their section", () => {
    expect(activeItem("/admin/pages", ["owner"])!.id).toBe("pages")
    expect(activeItem("/admin/collections/clients", ["owner"])!.id).toBe(
      "collections"
    )
    expect(activeItem("/admin/users-archive", ["owner"])).toBeNull()
    expect(activeItem("/admin/insights/0192", ["author"])!.id).toBe("insights")
  })
})

describe("shell adapters (B1 → B4 bridge, current routes)", () => {
  const labels = (roles: Role[]) =>
    menuSections(roles).map((s) => [s.label, s.items.map((i) => i.label)])

  it("the sidebar shows the registry's groups and labels", () => {
    for (const role of ROLES) expect(labels([role])).toEqual(menu([role]))
  })

  it("links point at pages that exist today", () => {
    const owner = menuSections(["owner"]).flatMap((s) => s.items)
    const href = (id: string) => owner.find((i) => i.id === id)!.href
    expect(href("insights")).toBe("/admin/articles")
    expect(href("collections")).toBe("/admin/team")
    expect(href("marketing")).toBe("/admin/marketing")
    expect(href("settings")).toBe("/admin/settings/site")
    const destinations = navDestinations(["owner"]).map((d) => d.href)
    for (const target of Object.values(CURRENT_ROUTES))
      expect(destinations).toContain(target)
    for (const moved of Object.keys(CURRENT_ROUTES))
      if (!Object.values(CURRENT_ROUTES).includes(moved))
        expect(destinations).not.toContain(moved)
    expect(destinations).not.toContain("/admin/help")
    expect(new Set(destinations).size).toBe(destinations.length)
  })

  it("dock keeps Account until /admin/help exists", () => {
    expect(dockItems(["owner"]).map((i) => [i.label, i.href])).toEqual([
      ["Users & roles", "/admin/users"],
      ["Activity log", "/admin/activity"],
      ["Account", "/admin/account"],
    ])
    for (const role of [
      "editor",
      "viewer",
      "marketer",
      "author",
      "intake",
    ] as const)
      expect(dockItems([role]).map((i) => i.label)).toEqual(["Account"])
  })

  it("⌘K destinations follow reachableLinks, permission-filtered", () => {
    for (const role of ROLES)
      expect(navDestinations([role]).map((d) => d.label)).toEqual(
        reachableLinks([role])
          .filter((l) => l.id !== "help")
          .map((l) => l.label)
      )
    expect(navDestinations(["marketer"]).map((d) => d.label)).not.toContain(
      "Custom code"
    )
    expect(
      navDestinations(["editor"]).find((d) => d.label === "Team")
    ).toMatchObject({ href: "/admin/team", parent: "Collections" })
  })

  it("findNavItem finds Collections by id at current routes", () => {
    expect(
      findNavItem(["editor"], "collections")!.children!.map((c) => c.href)
    ).toEqual(["/admin/team", "/admin/clients", "/admin/group-companies"])
    expect(findNavItem(["author"], "collections")).toBeUndefined()
  })

  it("isActiveItem marks a section active on any sub-page", () => {
    const owner = menuSections(["owner"]).flatMap((s) => s.items)
    const find = (id: string) => owner.find((i) => i.id === id)!
    expect(isActiveItem(find("collections"), "/admin/clients")).toBe(true)
    expect(isActiveItem(find("insights"), "/admin/categories")).toBe(true)
    expect(isActiveItem(find("collections"), "/admin/services")).toBe(false)
    expect(isActiveItem(find("dashboard"), "/admin")).toBe(true)
    expect(isActiveItem(find("dashboard"), "/admin/pages")).toBe(false)
    expect(isActiveItem(find("seo"), "/admin/seo/redirects")).toBe(true)
    // B3 pages live at their registry hrefs.
    expect(isActiveItem(find("marketing"), "/admin/marketing")).toBe(true)
    expect(isActiveItem(find("marketing"), "/admin/marketing/code")).toBe(true)
    expect(isActiveItem(find("settings"), "/admin/settings/ai-assistant")).toBe(
      true
    )
    expect(isActiveItem(dockItems(["owner"])[1]!, "/admin/activity")).toBe(true)
    const users = dockItems(["owner"])[0]!
    expect(isActiveItem(users, "/admin/users/0190f0e0")).toBe(true)
    expect(isActiveItem(users, "/admin/users-archive")).toBe(false)
  })
})

describe("isActiveItem also answers for the unmapped registry hrefs", () => {
  it("a section shown at a current route is active on its registry path", () => {
    // Every remaining CURRENT_ROUTES entry: the item (or its child) is mapped
    // to the page's current address, yet a pathname at the registry href
    // (e.g. reached through a redirect or a server link) still highlights it.
    const owner = menuSections(["owner"]).flatMap((s) => s.items)
    for (const registryHref of Object.keys(CURRENT_ROUTES)) {
      const section = NAV_ITEMS.find(
        (i) =>
          i.href === registryHref ||
          i.children?.some((c) => c.href === registryHref)
      )!
      const shown = owner.find((i) => i.id === section.id)!
      expect(isActiveItem(shown, registryHref)).toBe(true)
    }
    const insights = owner.find((i) => i.id === "insights")!
    expect(isActiveItem(insights, "/admin/insights/0192")).toBe(true)
    expect(isActiveItem(insights, "/admin/services")).toBe(false)
    const dashboard = owner.find((i) => i.id === "dashboard")!
    expect(isActiveItem(dashboard, "/admin/pages")).toBe(false)
  })
})

describe("firstVisibleChild (section index pages)", () => {
  it("is the first child the roles may open", () => {
    expect(firstVisibleChild("settings", ["viewer"])?.href).toBe(
      "/admin/settings/site"
    )
    expect(firstVisibleChild("collections", ["editor"])?.href).toBe(
      "/admin/collections/team"
    )
    expect(firstVisibleChild("marketing", ["marketer"])?.href).toBe(
      "/admin/marketing"
    )
  })

  it("is undefined when the section is hidden or has no children", () => {
    expect(firstVisibleChild("settings", ["author"])).toBeUndefined()
    expect(firstVisibleChild("collections", ["author"])).toBeUndefined()
    expect(firstVisibleChild("pages", ["owner"])).toBeUndefined()
    expect(firstVisibleChild("nope", ["owner"])).toBeUndefined()
  })
})
