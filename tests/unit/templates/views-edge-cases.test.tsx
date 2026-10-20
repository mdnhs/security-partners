import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ArticleHeader } from "@/components/blog/article"
import { BlogCard } from "@/components/blog/blog-card"
import { BlogPosts } from "@/components/blog/blog-posts"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { articleView, blogView } from "@/templates/blog/view"
import { homeView } from "@/templates/home/view"
import { serviceDetailView } from "@/templates/services/view"
import type { SiteSources } from "@/templates/shared/sources"

/** Fresh fixture sources to mutate (Dates survive structuredClone). */
const sources = (): SiteSources => structuredClone(fixtureSiteSources())

describe("admin-editable link hrefs go through interpolateHref (ruling)", () => {
  it("fixture links are unchanged", () => {
    const view = homeView(sources())
    expect(view.chrome.header.cta).toEqual({
      label: "Get a Quote",
      href: "/contact",
    })
    expect(view.chrome.footer.quickLinks.links.map((l) => l.href)).toEqual([
      "/about",
      "/services",
      "/team",
      "/blog",
      "/contact",
    ])
    expect(view.hero.primaryCta).toEqual({
      label: "Our Services",
      href: "#services",
    })
    expect(view.blog.cta).toEqual({ label: "View All Posts", href: "/blog" })
    expect(view.enquireBanner.cta).toEqual({
      label: "Get a Quote",
      href: "/contact",
    })
    const article = articleView(sources(), "key-holding-explained")!
    expect(article.header.breadcrumb.blogHref).toBe("/blog")
    expect(article.body.cta.link.href).toBe("/contact")
    const service = serviceDetailView(sources(), "alarm-responses")!
    expect(service.hero.trail).toEqual([
      { label: "Services", href: "/services" },
    ])
    expect(service.body.labels.cta.href).toBe("/contact")
  })

  it("fills {placeholders} in every stored link href", () => {
    const s = sources()
    const tel = "tel:+353858018746"
    const p = "{phone24hHref}"
    s.settings.navigation.headerLinks[0].href = p
    s.settings.navigation.headerCta.href = p
    s.settings.footer.legal.privacy.href = p
    s.settings.footer.legal.terms.href = p
    s.settings["sections.enquireBanner"].cta.href = p
    s.pages.home.data.hero.primaryCta.href = p
    s.pages.home.data.blog.cta.href = p
    s.settings.microcopy.breadcrumb.blogHref = p
    s.settings.microcopy.breadcrumb.servicesHref = p
    s.settings.microcopy.article.ctaHref = p
    s.settings.microcopy.service.ctaHref = p

    const home = homeView(s)
    expect(home.chrome.header.links[0]).toEqual({ label: "About", href: tel })
    expect(home.chrome.header.cta.href).toBe(tel)
    expect(home.chrome.footer.quickLinks.links[0].href).toBe(tel)
    expect(home.chrome.footer.legal.privacy.href).toBe(tel)
    expect(home.chrome.footer.legal.terms.href).toBe(tel)
    expect(home.enquireBanner.cta.href).toBe(tel)
    expect(home.hero.primaryCta.href).toBe(tel)
    expect(home.blog.cta.href).toBe(tel)

    const article = articleView(s, "key-holding-explained")!
    expect(article.header.breadcrumb.blogHref).toBe(tel)
    expect(article.body.cta.link.href).toBe(tel)

    const service = serviceDetailView(s, "alarm-responses")!
    expect(service.hero.trail?.[0].href).toBe(tel)
    expect(service.body.labels.cta.href).toBe(tel)
  })

  it("renders an unsafe or unresolved href as #", () => {
    const s = sources()
    s.settings.navigation.headerLinks[0].href = "javascript:alert(1)"
    s.settings.navigation.headerCta.href = "{noSuchPlaceholder}"
    s.pages.home.data.blog.cta.href = "//evil.example"
    const home = homeView(s)
    expect(home.chrome.header.links[0].href).toBe("#")
    expect(home.chrome.footer.quickLinks.links[0].href).toBe("#")
    expect(home.chrome.header.cta.href).toBe("#")
    expect(home.blog.cta.href).toBe("#")
  })
})

describe("service detail: other services with few published services", () => {
  const withServices = (count: number) => {
    const s = sources()
    s.services = s.services.slice(0, count)
    return s
  }
  const otherSlugs = (s: SiteSources, slug: string) =>
    serviceDetailView(s, slug)!.others.services.map((x) => x.slug)

  it("two services: just the other one", () => {
    const s = withServices(2)
    expect(otherSlugs(s, "alarm-responses")).toEqual([
      "mobile-patrols-key-holding",
    ])
    expect(otherSlugs(s, "mobile-patrols-key-holding")).toEqual([
      "alarm-responses",
    ])
  })

  it("three services: the other two, wrapping, no duplicates", () => {
    const s = withServices(3)
    expect(otherSlugs(s, "alarm-responses")).toEqual([
      "mobile-patrols-key-holding",
      "open-up-lock-ups",
    ])
    expect(otherSlugs(s, "open-up-lock-ups")).toEqual([
      "alarm-responses",
      "mobile-patrols-key-holding",
    ])
  })

  it("one service: no other cards", () => {
    expect(otherSlugs(withServices(1), "alarm-responses")).toEqual([])
  })

  it("six services: the next three, wrapping (unchanged)", () => {
    expect(otherSlugs(sources(), "event-security")).toEqual([
      "alarm-responses",
      "mobile-patrols-key-holding",
      "open-up-lock-ups",
    ])
  })
})

describe("articles without a publish date show no date", () => {
  const slug = "planning-security-for-your-next-event"
  const undated = () => {
    const s = sources()
    s.articles.find((a) => a.slug === slug)!.publishedAt = null
    return s
  }

  it("views carry null dates instead of 1970", () => {
    const s = undated()
    const card = blogView(s).posts.posts.find((p) => p.slug === slug)!
    expect(card).toMatchObject({ date: null, displayDate: null })
    const view = articleView(s, slug)!
    expect(view.header.article).toMatchObject({
      date: null,
      displayDate: null,
    })
    const recent = articleView(
      s,
      "mobile-patrols-protect-your-business-after-hours"
    )!.body.recent.find((p) => p.slug === slug)!
    expect(recent).toMatchObject({ date: null, displayDate: null })
  })

  it("renders no <time> for the undated article", () => {
    const s = undated()
    const card = blogView(s).posts.posts.find((p) => p.slug === slug)!
    const cardHtml = renderToStaticMarkup(
      <BlogCard post={card} readArticle="Read" />
    )
    expect(cardHtml).not.toContain("<time")
    expect(cardHtml).not.toContain("1970")
    const header = renderToStaticMarkup(
      <ArticleHeader {...articleView(s, slug)!.header} />
    )
    expect(header).not.toContain("<time")
    expect(header).not.toContain("1970")

    const dated = renderToStaticMarkup(
      <BlogCard post={blogView(sources()).posts.posts[0]} readArticle="Read" />
    )
    expect(dated).toContain('<time dateTime="2026-09-12"')
  })
})

describe("blog without a featured article", () => {
  it("featuredArticle null: no featured, every article listed", () => {
    const s = sources()
    s.pages.blog.data.featuredArticle = null
    const view = blogView(s)
    expect(view.posts.featured).toBeNull()
    expect(view.posts.posts.map((p) => p.slug)).toEqual(
      s.articles.map((a) => a.slug)
    )
  })

  it("featured slug not published: featured is null", () => {
    const s = sources()
    s.pages.blog.data.featuredArticle = "not-published"
    expect(blogView(s).posts.featured).toBeNull()
  })

  it("BlogPosts renders no featured card and a full first page", () => {
    const s = sources()
    s.pages.blog.data.featuredArticle = null
    const html = renderToStaticMarkup(<BlogPosts {...blogView(s).posts} />)
    expect(html).not.toContain(">Featured<")
    expect(html.match(/<li>/g)).toHaveLength(6)
  })
})

describe("articles with empty tags show the category tag", () => {
  it("tags [] → [category name]", () => {
    const s = sources()
    expect(
      s.articles.find((a) => a.slug === "key-holding-explained")!.content.tags
    ).toEqual([])
    expect(articleView(s, "key-holding-explained")!.body.tags).toEqual([
      "Key Holding",
    ])
  })
})
