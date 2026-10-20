import { describe, expect, it } from "vitest"

import {
  EDITABLE_SETTINGS_KEYS,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import {
  activeChild,
  activeItem,
  dockLinks,
  EXTRA_LINKS,
  HELP_LINK,
  NAV_GROUPS,
  NAV_ITEMS,
  type NavLink,
  permissionFor,
  reachableLinks,
  visibleNav,
} from "@/lib/admin/nav"
import { statements } from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"

const allLinks = (): NavLink[] => [
  ...NAV_ITEMS.flatMap((item) => [item, ...(item.children ?? [])]),
  HELP_LINK,
  ...EXTRA_LINKS,
]

describe("nav registry (MK IA, spec §5.1)", () => {
  it("every badged item names its count for screen readers", () => {
    const badged = NAV_ITEMS.filter((item) => item.badge)
    expect(badged.map((item) => [item.id, item.badgeLabel])).toEqual([
      ["leads", "new enquiries"],
    ])
  })

  it("Insights holds Articles and Categories; Collections the rest", () => {
    const hrefs = (id: string) =>
      NAV_ITEMS.find((item) => item.id === id)!.children!.map((c) => c.href)
    expect(hrefs("insights")).toEqual([
      "/admin/insights",
      "/admin/insights/categories",
    ])
    expect(hrefs("collections")).toEqual([
      "/admin/collections/team",
      "/admin/collections/clients",
      "/admin/collections/group-companies",
    ])
  })

  it("groups are Menu, Growth, General in order", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([
      "Menu",
      "Growth",
      "General",
    ])
    expect(visibleNav(["owner"]).map((g) => g.label)).toEqual([
      "Menu",
      "Growth",
      "General",
    ])
  })

  it("registers the spec's item ids in order", () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      "dashboard",
      "pages",
      "insights",
      "services",
      "collections",
      "media",
      "leads",
      "seo",
      "marketing",
      "appearance",
      "settings",
      "users",
      "activity",
    ])
    expect(HELP_LINK).toMatchObject({ id: "help", href: "/admin/help" })
    expect(EXTRA_LINKS.map((l) => [l.id, l.href])).toEqual([
      ["account", "/admin/account"],
      ["design", "/admin/design"],
    ])
  })

  it("only /admin matches exactly", () => {
    for (const item of NAV_ITEMS)
      expect(item.match).toBe(item.href === "/admin" ? "exact" : "prefix")
  })

  it("permissionFor resolves exact, nested and unknown paths", () => {
    expect(permissionFor("/admin")).toBeNull()
    expect(permissionFor("/admin/insights/0192a")).toEqual({
      article: ["read"],
    })
    expect(permissionFor("/admin/insights/categories")).toEqual({
      collection: ["read"],
    })
    expect(permissionFor("/admin/marketing/code")).toEqual({
      customCode: ["read"],
    })
    expect(permissionFor("/admin/marketing/events")).toEqual({
      marketing: ["read"],
    })
    expect(permissionFor("/admin/settings/ai-assistant")).toEqual({
      integration: ["read"],
    })
    expect(permissionFor("/admin/settings/integrations/smtp")).toEqual({
      integration: ["read"],
    })
    expect(permissionFor("/admin/design")).toEqual({ customCode: ["update"] })
    // The page builder (D5.5) sits under the "pages" item.
    expect(permissionFor("/admin/pages/custom/x")).toEqual({ page: ["read"] })
    expect(
      permissionFor("/admin/pages/custom/0199a000-0000-7000-8000-000000000000")
    ).toEqual({ page: ["read"] })
    expect(permissionFor("/admin/nope")).toBeUndefined()
    expect(permissionFor("/admin/insightsx")).toBeUndefined()
  })

  it("permissionFor covers every registered page and its sub-paths", () => {
    expect(permissionFor("/admin/leads/0192")).toEqual({ lead: ["read"] })
    expect(permissionFor("/admin/seo/redirects")).toEqual({
      redirect: ["read"],
    })
    expect(permissionFor("/admin/settings/site")).toEqual({
      settings: ["read"],
    })
    expect(permissionFor("/admin/activity")).toEqual({ audit: ["read"] })
    expect(permissionFor("/admin/help")).toBeNull()
    expect(permissionFor("/admin/account")).toBeNull()
    expect(permissionFor("/admin/collections/team")).toEqual({
      collection: ["read"],
    })
    expect(permissionFor("/")).toBeUndefined()
    expect(permissionFor("/administrator")).toBeUndefined()
  })

  it("marketer sees Growth but not Custom code or Site settings AI", () => {
    const ids = reachableLinks(["marketer"]).map((l) => l.id)
    expect(ids).toContain("marketing-tracking")
    expect(ids).toContain("marketing-events")
    expect(ids).not.toContain("marketing-code")
    expect(ids).not.toContain("settings-ai-assistant")
  })

  it("dock is Users & roles, Activity log, Help for owners; Help only for authors", () => {
    expect(dockLinks(["owner"]).map((l) => l.label)).toEqual([
      "Users & roles",
      "Activity log",
      "Help",
    ])
    expect(dockLinks(["author"]).map((l) => l.label)).toEqual(["Help"])
  })

  it("activeItem/activeChild use the longest prefix", () => {
    const item = activeItem("/admin/seo/redirects", ["owner"])!
    expect(item.id).toBe("seo")
    expect(activeChild(item, "/admin/seo/redirects")!.id).toBe("seo-redirects")
    expect(activeChild(item, "/admin/seo")!.id).toBe("seo-overview")
    expect(activeItem("/admin", ["author"])!.id).toBe("dashboard")
    expect(activeItem("/admin/insights/categories", ["owner"])!.id).toBe(
      "insights"
    )
    const settings = activeItem("/admin/settings/integrations/smtp", ["owner"])!
    expect(activeChild(settings, "/admin/settings/integrations/smtp")!.id).toBe(
      "settings-integrations"
    )
    expect(activeItem("/admin/users/0192", ["owner"])!.id).toBe("users")
    expect(activeItem("/admin/users/0192", ["editor"])).toBeNull()
    expect(activeItem("/admin/nope", ["owner"])).toBeNull()
  })

  it("every href is unique and every child permission is a subset of a statement", () => {
    // A section's first child may share its parent's href (Insights › Articles).
    const leaves = [
      ...NAV_ITEMS.flatMap((item) => item.children ?? [item]),
      HELP_LINK,
      ...EXTRA_LINKS,
    ]
    expect(new Set(leaves.map((l) => l.href)).size).toBe(leaves.length)
    expect(new Set(allLinks().map((l) => l.id)).size).toBe(allLinks().length)
    for (const role of ROLES) {
      const links = reachableLinks([role])
      expect(new Set(links.map((l) => l.href)).size).toBe(links.length)
    }
    for (const link of allLinks()) {
      expect(link.href === "/admin" || link.href.startsWith("/admin/")).toBe(
        true
      )
      if (link.permission === null) continue
      const entries = Object.entries(link.permission)
      expect(entries.length).toBeGreaterThan(0)
      for (const [resource, actions] of entries) {
        expect(Object.hasOwn(statements, resource)).toBe(true)
        const allowed = statements[resource as keyof typeof statements]
        for (const action of actions as string[])
          expect(allowed as readonly string[]).toContain(action)
      }
    }
  })

  it("Appearance sits in General before Site settings (MK, C5)", () => {
    const appearance = NAV_ITEMS.find((i) => i.id === "appearance")!
    expect(appearance).toMatchObject({
      group: "general",
      label: "Appearance",
      href: "/admin/appearance",
      permission: { appearance: ["read"] },
      match: "prefix",
      keywords: ["theme", "colours", "colors", "brand", "logo"],
    })
    expect(appearance.children).toBeUndefined()
    expect(appearance.dock).toBeUndefined()
    expect(permissionFor("/admin/appearance")).toEqual({
      appearance: ["read"],
    })
    const general = visibleNav(["owner"]).find((g) => g.group === "general")!
    expect(general.items.map((i) => i.id).slice(0, 2)).toEqual([
      "appearance",
      "settings",
    ])
    // Every appearance reader sees it; author and intake do not.
    for (const role of [
      "owner",
      "admin",
      "editor",
      "marketer",
      "viewer",
    ] as const)
      expect(reachableLinks([role]).map((l) => l.id)).toContain("appearance")
    for (const role of ["author", "intake"] as const)
      expect(reachableLinks([role]).map((l) => l.id)).not.toContain(
        "appearance"
      )
  })

  it("AI assistant child has ⌘K keywords", () => {
    expect(
      reachableLinks(["owner"]).find((l) => l.id === "settings-ai-assistant")!
        .keywords
    ).toEqual(
      expect.arrayContaining([
        "ai",
        "assistant",
        "claude",
        "openai",
        "gemini",
        "chatbot",
      ])
    )
  })

  it("Site settings has one child per editable key, then AI assistant and Integrations", () => {
    const settings = NAV_ITEMS.find((i) => i.id === "settings")!
    expect(settings).toMatchObject({
      label: "Site settings",
      href: "/admin/settings",
      group: "general",
    })
    expect(settings.children!.map((c) => [c.id, c.label, c.href])).toEqual([
      ...EDITABLE_SETTINGS_KEYS.map((key) => [
        `settings-${key}`,
        SETTINGS_ENTRIES[key].label,
        `/admin/settings/${key}`,
      ]),
      ["settings-ai-assistant", "AI assistant", "/admin/settings/ai-assistant"],
      ["settings-integrations", "Integrations", "/admin/settings/integrations"],
    ])
    for (const key of EDITABLE_SETTINGS_KEYS)
      expect(permissionFor(`/admin/settings/${key}`)).toEqual(
        SETTINGS_ENTRIES[key].read
      )
  })
})
