import { describe, expect, it } from "vitest"

import {
  activeChild,
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
            "Website",
            "Media",
            "Enquiries",
            "Live chat",
            "Job applications",
          ],
        ],
        ["Growth", ["SEO", "Marketing"]],
        ["General", ["Appearance", "Site settings"]],
      ],
    ],
    [
      "editor",
      [
        ["Menu", ["Dashboard", "Website", "Media"]],
        ["Growth", ["SEO"]],
        ["General", ["Appearance", "Site settings"]],
      ],
    ],
    [
      "viewer",
      [
        ["Menu", ["Dashboard", "Website", "Media"]],
        ["Growth", ["SEO", "Marketing"]],
        ["General", ["Appearance", "Site settings"]],
      ],
    ],
    [
      "marketer",
      [
        ["Menu", ["Dashboard", "Website", "Media"]],
        ["Growth", ["SEO", "Marketing"]],
        ["General", ["Appearance"]],
      ],
    ],
    ["author", [["Menu", ["Dashboard", "Website", "Media"]]]],
    [
      "intake",
      [["Menu", ["Dashboard", "Enquiries", "Live chat", "Job applications"]]],
    ],
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
      "Event catalogue",
      "Custom code",
    ])
    // Custom code stays owner-only.
    for (const role of ["admin", "marketer", "viewer"] as const)
      expect(children([role], "marketing")).toEqual([
        "Tracking",
        "Consent banner",
        "Event catalogue",
      ])
    expect(children(["editor"], "seo")).toEqual(["Overview", "Defaults"])
    expect(children(["marketer"], "seo")).toEqual([
      "Overview",
      "Defaults",
      "Redirects",
    ])
    // Website lists the public site page by page; each role sees its own.
    expect(children(["author"], "website")).toEqual(["Blog"])
    expect(children(["marketer"], "website")).toEqual([
      "Home",
      "About",
      "Services",
      "Team",
      "Blog",
      "Contact",
      "Careers",
      "Custom pages",
      "Legal pages",
    ])
    expect(children(["owner"], "website")).toEqual([
      "Home",
      "About",
      "Services",
      "Team",
      "Blog",
      "Contact",
      "Careers",
      "Custom pages",
      "Legal pages",
      "Header & footer",
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
      // The section's own terms, carried on the link (not looked up by label).
      parentKeywords: item("seo").keywords,
      href: "/admin/seo/redirects",
    })
    expect(item("seo").keywords?.length).toBeGreaterThan(0)
    expect(owner.find((l) => l.id === "leads")).toMatchObject({
      parent: null,
      parentKeywords: [],
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
    expect(menu(["author"]).flat(2)).not.toContain("Marketing")
    expect(menu(["intake"]).flat(2)).not.toContain("Site settings")
  })

  it("activeItem: /admin is exact; sub-pages and ids select their section", () => {
    expect(activeItem("/admin/website/home", ["owner"])!.id).toBe("website")
    expect(activeItem("/admin/settings/site", ["owner"])!.id).toBe("settings")
    expect(activeItem("/admin/users-archive", ["owner"])).toBeNull()
    expect(activeItem("/admin/insights/0192", ["author"])!.id).toBe("website")
  })

  it("activeItem/activeChild: owned paths select Website and the owning screen", () => {
    const at = (path: string) => {
      const found = activeItem(path, ["owner"])!
      return [found.id, activeChild(found, path)?.id ?? null]
    }
    expect(at("/admin/services/x")).toEqual(["website", "website-services"])
    expect(at("/admin/insights")).toEqual(["website", "website-blog"])
    expect(at("/admin/insights/categories")).toEqual([
      "website",
      "website-blog",
    ])
    expect(at("/admin/careers")).toEqual(["website", "website-careers"])
    expect(at("/admin/careers/jobs/0192")).toEqual([
      "website",
      "website-careers",
    ])
    expect(at("/admin/pages/custom/x")).toEqual([
      "website",
      "website-custom-pages",
    ])
    expect(at("/admin/pages/legal/x")).toEqual(["website", "website-legal"])
    expect(at("/admin/website/legal/privacy")).toEqual([
      "website",
      "website-legal",
    ])
    expect(at("/admin/website/header-footer/footer")).toEqual([
      "website",
      "website-header-footer",
    ])
    // Applications stays its own item.
    expect(at("/admin/careers/applications/x")).toEqual(["careers", null])
  })

  it("⌘K finds the Website parts, labelled with their screen", () => {
    const owner = reachableLinks(["owner"])
    expect(owner.find((l) => l.label === "Client logos")).toMatchObject({
      parent: "Home",
      href: "/admin/website/home/clients",
    })
    expect(owner.find((l) => l.label === "Footer")).toMatchObject({
      parent: "Header & footer",
      href: "/admin/website/header-footer/footer",
    })
    expect(owner.find((l) => l.label === "All services")).toMatchObject({
      parent: "Services",
      href: "/admin/services",
    })
    const author = reachableLinks(["author"]).map((l) => l.href)
    expect(author).toContain("/admin/insights")
    expect(author).not.toContain("/admin/insights/categories")
  })
})

describe("firstVisibleChild (section index pages)", () => {
  it("is the first child the roles may open", () => {
    expect(firstVisibleChild("settings", ["viewer"])?.href).toBe(
      "/admin/settings/site"
    )
    expect(firstVisibleChild("website", ["editor"])?.href).toBe(
      "/admin/website/home"
    )
    expect(firstVisibleChild("website", ["author"])?.href).toBe(
      "/admin/website/blog"
    )
    expect(firstVisibleChild("marketing", ["marketer"])?.href).toBe(
      "/admin/marketing"
    )
  })

  it("is undefined when the section is hidden or has no children", () => {
    expect(firstVisibleChild("settings", ["author"])).toBeUndefined()
    expect(firstVisibleChild("website", ["intake"])).toBeUndefined()
    expect(firstVisibleChild("dashboard", ["owner"])).toBeUndefined()
    expect(firstVisibleChild("nope", ["owner"])).toBeUndefined()
  })
})
