import { existsSync, globSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  articleLinks,
  canFollow,
  canReadArticle,
  groupedArticles,
  HELP_ARTICLES,
  HELP_GROUPS,
  HELP_HREF,
  headingId,
  helpArticle,
  linkPath,
  neighbours,
  tocFor,
  visibleArticles,
} from "@/lib/admin/help/registry"
import { permissionFor } from "@/lib/admin/nav"
import { isWebsiteKey } from "@/lib/admin/website"
import { hasPermission } from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"

const slugs = (articles: readonly { slug: string }[]) =>
  articles.map((article) => article.slug)

const PANEL = "app/(admin)/admin/(panel)"
const PANEL_PAGES = globSync(`${PANEL}/**/page.tsx`).map((file) =>
  file
    .slice(PANEL.length, -"/page.tsx".length)
    .split("/")
    .filter((segment) => segment && !/^\(.*\)$/.test(segment))
)

/**
 * A panel page file serves `path`: each segment matches literally, or a
 * [dynamic] one (a Website screen's [key] only when it is a real screen).
 */
function hasPageFile(path: string): boolean {
  const segments = path.split("/").filter(Boolean).slice(1)
  return PANEL_PAGES.some(
    (route) =>
      route.length === segments.length &&
      route.every((part, index) => {
        const segment = segments[index]!
        if (part === segment) return true
        if (!part.startsWith("[")) return false
        if (route[index - 1] === "website" && part === "[key]")
          return isWebsiteKey(segment)
        return true
      })
  )
}

describe("help registry", () => {
  it("has unique slugs", () => {
    const all = slugs(HELP_ARTICLES)
    expect(new Set(all).size).toBe(all.length)
  })

  it("files every article under a known group, and every group has one", () => {
    const ids = new Set(HELP_GROUPS.map((group) => group.id))
    for (const article of HELP_ARTICLES) expect(ids).toContain(article.group)
    for (const group of HELP_GROUPS)
      expect(
        HELP_ARTICLES.filter((article) => article.group === group.id),
        group.id
      ).not.toHaveLength(0)
  })

  it("covers the admin's areas", () => {
    expect(slugs(HELP_ARTICLES)).toEqual(
      expect.arrayContaining([
        "getting-started",
        "saving-and-publishing",
        "roles",
        "website-pages",
        "page-sections",
        "header-footer",
        "custom-pages",
        "legal-pages",
        "services",
        "blog-articles",
        "careers-jobs",
        "team-and-clients",
        "media",
        "enquiries",
        "live-chat",
        "job-applications",
        "seo",
        "redirects",
        "canonical-urls",
        "marketing",
        "custom-code",
        "site-settings",
        "appearance",
        "ai-assistant",
        "integrations",
        "users",
        "activity-log",
        "account",
        "troubleshooting",
      ])
    )
  })

  describe.each(HELP_ARTICLES.map((article) => [article.slug, article]))(
    "%s",
    (_, article) => {
      it("links only to registered admin screens and help articles", () => {
        for (const href of articleLinks(article)) {
          const path = linkPath(href)
          const hash = href.includes("#") ? href.split("#")[1] : undefined
          expect(path, href).toMatch(/^\/admin(\/|$)/)
          if (path.startsWith(`${HELP_HREF}/`)) {
            const target = helpArticle(path.slice(HELP_HREF.length + 1))
            expect(target, href).toBeDefined()
            if (hash)
              expect(tocFor(target!).map((entry) => entry.id)).toContain(hash)
          } else if (path !== HELP_HREF) {
            // The registry the sidebar and every page guard read…
            expect(permissionFor(path), href).not.toBeUndefined()
            // …and a page that really serves it.
            expect(hasPageFile(path), href).toBe(true)
          }
        }
      })

      it("has a title, description, lead and sections", () => {
        expect(article.title).not.toBe("")
        expect(article.description).not.toBe("")
        expect(article.lead).not.toBe("")
        expect(article.sections.length).toBeGreaterThan(0)
      })

      it("has unique section anchors", () => {
        const ids = tocFor(article).map((entry) => entry.id)
        expect(new Set(ids).size).toBe(ids.length)
      })
    }
  )

  it("keeps docs style: no exclamation marks", () => {
    for (const article of HELP_ARTICLES)
      for (const text of [
        article.title,
        article.description,
        article.lead,
        ...article.sections.flatMap((section) => [
          section.title,
          ...section.blocks.flatMap((block) =>
            block.type === "p" || block.type === "callout"
              ? [block.text]
              : block.type === "open"
                ? [block.label]
                : block.items
          ),
        ]),
      ])
        expect(text, article.slug).not.toMatch(/!(?!\[)/)
  })
})

/** The main articles: each groups its content so the TOC rail bends. */
const STRUCTURED = [
  "getting-started",
  "saving-and-publishing",
  "roles",
  "website-pages",
  "page-sections",
  "header-footer",
  "custom-pages",
  "legal-pages",
  "services",
  "blog-articles",
  "careers-jobs",
  "team-and-clients",
  "media",
  "enquiries",
  "live-chat",
  "job-applications",
  "seo",
  "canonical-urls",
  "redirects",
  "marketing",
  "site-settings",
  "appearance",
  "users",
  "integrations",
  "troubleshooting",
]

describe("sub-sections", () => {
  it.each(STRUCTURED)("%s has level-3 sub-sections", (slug) => {
    const article = helpArticle(slug)!
    expect(article, slug).toBeDefined()
    expect(article.sections.some((section) => section.level === 3)).toBe(true)
  })

  it("never starts a sub-section without a section above it", () => {
    for (const article of HELP_ARTICLES)
      expect(article.sections[0]?.level ?? 2, article.slug).toBe(2)
  })

  it("gives a heading-only section at least one sub-section", () => {
    for (const article of HELP_ARTICLES)
      article.sections.forEach((section, index) => {
        if (section.blocks.length > 0) return
        expect(article.sections[index + 1]?.level, section.title).toBe(3)
      })
  })
})

describe("tocFor and headingId", () => {
  it("builds one entry per section heading, in order", () => {
    for (const article of HELP_ARTICLES)
      expect(tocFor(article).map((entry) => entry.title)).toEqual(
        article.sections.map((section) => section.title)
      )
  })

  it("makes readable anchors", () => {
    expect(headingId("Header & footer")).toBe("header-and-footer")
    expect(headingId("Search with ⌘K")).toBe("search-with-k")
  })
})

describe("role filtering", () => {
  it("shows an owner every article", () => {
    expect(slugs(visibleArticles(["owner"]))).toEqual(slugs(HELP_ARTICLES))
  })

  it("shows an author the basics and article topics only", () => {
    const visible = slugs(visibleArticles(["author"]))
    expect(visible).toEqual(
      expect.arrayContaining([
        "getting-started",
        "saving-and-publishing",
        "blog-articles",
        "media",
        "account",
        "troubleshooting",
      ])
    )
    for (const hidden of [
      "website-pages",
      "page-sections",
      "header-footer",
      "services",
      "blog-categories",
      "careers-jobs",
      "team-and-clients",
      "enquiries",
      "live-chat",
      "job-applications",
      "seo",
      "marketing",
      "site-settings",
      "users",
      "activity-log",
    ])
      expect(visible).not.toContain(hidden)
  })

  it("shows intake enquiries, applications and chat, no website docs", () => {
    const visible = slugs(visibleArticles(["intake"]))
    expect(visible).toEqual(
      expect.arrayContaining([
        "getting-started",
        "enquiries",
        "live-chat",
        "job-applications",
        "account",
        "troubleshooting",
      ])
    )
    for (const hidden of [
      "website-pages",
      "blog-articles",
      "media",
      "seo",
      "users",
      "ai-assistant",
      "site-settings",
    ])
      expect(visible).not.toContain(hidden)
  })

  it("keeps custom code to owners", () => {
    expect(slugs(visibleArticles(["owner"]))).toContain("custom-code")
    for (const role of ROLES.filter((role) => role !== "owner"))
      expect(slugs(visibleArticles([role])), role).not.toContain("custom-code")
  })

  it("lists only articles whose screens each role opens", () => {
    for (const role of ROLES)
      for (const article of visibleArticles([role]))
        expect(canReadArticle([role], article)).toBe(true)
    // Spot-check against the permission table itself.
    expect(hasPermission(["marketer"], { marketing: ["read"] })).toBe(true)
    expect(slugs(visibleArticles(["marketer"]))).toContain("marketing")
    expect(slugs(visibleArticles(["marketer"]))).not.toContain("enquiries")
  })

  it("drops empty groups", () => {
    const groups = groupedArticles(["intake"])
    expect(groups.every((group) => group.articles.length > 0)).toBe(true)
    expect(groups.map((group) => group.id)).not.toContain("website")
    expect(groups.map((group) => group.id)).not.toContain("growth")
  })

  it("never offers a link to a screen the role cannot open", () => {
    expect(canFollow(["intake"], "/admin/leads")).toBe(true)
    expect(canFollow(["intake"], "/admin/users")).toBe(false)
    expect(canFollow(["author"], "/admin/website/blog")).toBe(true)
    expect(canFollow(["author"], "/admin/website/home")).toBe(false)
    expect(canFollow(["intake"], "/admin/help/roles")).toBe(true)
    expect(canFollow(["intake"], "/admin/help/media")).toBe(false)
    expect(canFollow(["owner"], "/admin/help/media#focal-point")).toBe(true)
    expect(canFollow(["owner"], "/admin/nowhere")).toBe(false)
  })

  it("steps Prev/Next through visible articles only", () => {
    const visible = slugs(visibleArticles(["intake"]))
    const { prev, next } = neighbours(["intake"], "enquiries")
    for (const article of [prev, next])
      if (article) expect(visible).toContain(article.slug)
    expect(neighbours(["owner"], "getting-started").prev).toBeUndefined()
    expect(neighbours(["owner"], "troubleshooting").next).toBeUndefined()
  })
})

describe("the link check itself", () => {
  it("rejects paths without a page", () => {
    expect(existsSync(`${PANEL}/help/page.tsx`)).toBe(true)
    expect(hasPageFile("/admin/website/home")).toBe(true)
    expect(hasPageFile("/admin/website/nope")).toBe(false)
    expect(hasPageFile("/admin/seo/nowhere")).toBe(false)
  })
})
