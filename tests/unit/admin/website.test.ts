import { describe, expect, it } from "vitest"

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { EDITABLE_SETTINGS_KEYS } from "@/lib/admin/settings-keys"
import {
  adminHrefForCollection,
  adminHrefForSettings,
  isWebsiteKey,
  isWebsiteSettingsKey,
  LEGAL_PAGE_KEYS,
  PAGE_SECTIONS,
  pageEditorHref,
  PART_ANCHORS,
  partHref,
  SITE_SETTINGS_KEYS,
  WEBSITE_PARTS,
  WEBSITE_SCREENS,
  websiteHref,
  websitePart,
  websiteTabs,
  withSearch,
} from "@/lib/admin/website"
import { COLLECTIONS } from "@/lib/schemas/api/collections"
import { PAGE_KEYS, PAGES, templates } from "@/templates/registry"

const PAGE_SCREEN_KEYS = PAGE_KEYS.filter(
  (key) => !(LEGAL_PAGE_KEYS as readonly string[]).includes(key)
)

describe("website registry", () => {
  it("lists one screen per fixed page (legal ones aside), then custom-pages, legal, header-footer", () => {
    expect(WEBSITE_SCREENS.map((s) => s.key)).toEqual([
      ...PAGE_SCREEN_KEYS,
      "custom-pages",
      "legal",
      "header-footer",
    ])
    for (const key of PAGE_SCREEN_KEYS) {
      const screen = WEBSITE_SCREENS.find((s) => s.key === key)!
      expect(screen.label).toBe(PAGE_LABELS[key])
      expect(screen.page).toBe(key)
    }
    expect(isWebsiteKey("header-footer")).toBe(true)
    expect(isWebsiteKey("privacy")).toBe(false)
    expect(isWebsiteKey("nope")).toBe(false)
    expect(isWebsiteKey("toString")).toBe(false)
  })

  it("keeps identity and operations under Site settings", () => {
    expect([...SITE_SETTINGS_KEYS]).toEqual([
      "site",
      "leads",
      "careers",
      "chat",
    ])
  })

  it("places every editable settings key exactly once", () => {
    for (const key of EDITABLE_SETTINGS_KEYS)
      expect(
        isWebsiteSettingsKey(key),
        `${key}: place it as a Website part or in SITE_SETTINGS_KEYS`
      ).not.toBe((SITE_SETTINGS_KEYS as readonly string[]).includes(key))
    const settingsKeys = WEBSITE_PARTS.flatMap((p) =>
      p.source.kind === "settings" ? [p.source.key] : []
    )
    expect(new Set(settingsKeys).size).toBe(settingsKeys.length)
  })

  it("homes every collection", () => {
    for (const name of COLLECTIONS) {
      const href = adminHrefForCollection(name)
      expect(
        href.startsWith("/admin/website/") ||
          href === "/admin/insights/categories",
        `${name} → ${href}`
      ).toBe(true)
    }
    expect(adminHrefForCollection("categories")).toBe(
      "/admin/insights/categories"
    )
    expect(adminHrefForCollection("team")).toBe("/admin/website/team/team")
  })

  it("hrefs", () => {
    expect(websiteHref("home")).toBe("/admin/website/home")
    expect(partHref(websitePart("home", "clients")!)).toBe(
      "/admin/website/home/clients"
    )
    expect(partHref(websitePart("services", "all-services")!)).toBe(
      "/admin/services"
    )
    expect(websitePart("home", "footer")).toBeUndefined()
    expect(adminHrefForSettings("footer")).toBe(
      "/admin/website/header-footer/footer"
    )
    expect(adminHrefForSettings("navigation")).toBe(
      "/admin/website/header-footer/navigation"
    )
    expect(adminHrefForSettings("site")).toBe("/admin/settings/site")
    expect(pageEditorHref("about")).toBe("/admin/website/about")
    expect(pageEditorHref("privacy")).toBe("/admin/website/legal/privacy")
  })

  it("websiteTabs by role", () => {
    const ids = (screen: Parameters<typeof websiteTabs>[0], role: string) =>
      websiteTabs(screen, [role]).map((t) => t.id)
    // Sections and lists inside the page's form are not tabs.
    expect(ids("home", "owner")).toEqual(["page"])
    expect(ids("contact", "owner")).toEqual(["page"])
    expect(ids("team", "owner")).toEqual(["page"])
    expect(ids("blog", "owner")).toEqual(["page", "articles", "categories"])
    expect(ids("blog", "author")).toEqual(["articles"])
    expect(ids("services", "owner")).toEqual(["page"])
    expect(ids("header-footer", "owner")).toEqual([
      "navigation",
      "footer",
      "microcopy",
      "group-companies",
    ])
    expect(ids("home", "marketer")).toEqual(["page"])
    expect(ids("home", "intake")).toEqual([])
    expect(websiteTabs("home", ["owner"])[0]).toEqual({
      id: "page",
      label: "Page",
      href: "/admin/website/home",
    })
    expect(websiteTabs("blog", ["author"])[0].href).toBe("/admin/insights")
    expect(websiteTabs("header-footer", ["owner"])[0].label).toBe("Header menu")
  })

  it("part ids are unique; All services is a route part, not a tab", () => {
    const ids = WEBSITE_PARTS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(websitePart("services", "all-services")!.tab).toBe(false)
  })

  it("each page section is a settings part of that page's screen, placed after a real group", () => {
    for (const [page, sections] of Object.entries(PAGE_SECTIONS)) {
      const shape = templates[PAGES[page as keyof typeof PAGES]].schema.shape
      const keys = new Set([
        ...Object.keys(shape),
        ...sections!.map((s) => s.key),
      ])
      for (const section of sections!) {
        expect(Object.keys(shape), `${page}.${section.key}`).not.toContain(
          section.key
        )
        if (section.after !== null) expect(keys).toContain(section.after)
        expect(
          WEBSITE_PARTS.some(
            (p) =>
              p.screen === page &&
              p.source.kind === "settings" &&
              p.source.key === section.settings
          ),
          `${page}: ${section.settings}`
        ).toBe(true)
      }
    }
  })

  it("each anchored list is a part of that page's screen, after a real group", () => {
    for (const [page, anchors] of Object.entries(PART_ANCHORS)) {
      const shape = templates[PAGES[page as keyof typeof PAGES]].schema.shape
      const keys = [
        ...Object.keys(shape),
        ...(PAGE_SECTIONS[page as keyof typeof PAGES] ?? []).map((s) => s.key),
      ]
      for (const [group, ids] of Object.entries(anchors!)) {
        expect(keys, `${page}: ${group}`).toContain(group)
        for (const id of ids)
          expect(
            websitePart(page as "home", id),
            `${page}: ${id}`
          ).toBeDefined()
      }
    }
  })

  it("withSearch keeps the query", () => {
    expect(
      withSearch("/a", { edit: "x", tag: ["1", "2"], none: undefined })
    ).toBe("/a?edit=x&tag=1&tag=2")
    expect(withSearch("/a", {})).toBe("/a")
  })
})
