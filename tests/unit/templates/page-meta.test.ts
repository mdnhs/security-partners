import { describe, expect, it } from "vitest"

import { interpolate } from "@/lib/interpolate"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import {
  articleMetadata,
  pageMetadata,
  serviceMetadata,
  siteMetadata,
} from "@/templates/shared/page-meta"
import { placeholders } from "@/templates/shared/views"

const s = fixtureSiteSources()
const defaults = s.settings["seo.defaults"]

describe("public page metadata (spec §10)", () => {
  it("home: site title, canonical /, generated share card, large Twitter card", () => {
    const meta = pageMetadata(s, "home")
    expect(meta.title).toBe("Security Partners Ltd. | Watching Over You")
    expect(meta.alternates).toEqual({ canonical: "/" })
    expect(meta.robots).toBeUndefined()
    expect(meta.openGraph).toMatchObject({
      type: "website",
      url: "/",
      siteName: s.settings.site.name,
      title: "Security Partners Ltd. | Watching Over You",
      images: [{ url: "/og/page/home", width: 1200, height: 630 }],
    })
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: [{ url: "/og/page/home" }],
    })
  })

  it("a record's own SEO wins; blank fields fall back", () => {
    const custom = structuredClone(s)
    custom.pages.about.seo = {
      title: "",
      description: "Custom about",
      canonical: "https://example.ie/about-us",
      noindex: true,
      ogImage: {
        id: "m1",
        url: "/images/about.png",
        alt: "Our team",
        width: 800,
        height: 600,
        blurDataUrl: null,
      },
    }
    const meta = pageMetadata(custom, "about")
    expect(meta.title).toBe(
      interpolate(defaults.titleTemplate, {
        title: custom.pages.about.data.hero.title,
      })
    )
    expect(meta.description).toBe("Custom about")
    expect(meta.alternates).toEqual({
      canonical: "https://example.ie/about-us",
    })
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(meta.openGraph).toMatchObject({
      images: [
        { url: "/images/about.png", width: 800, height: 600, alt: "Our team" },
      ],
    })
    expect(meta.twitter).toMatchObject({
      images: [{ url: "/images/about.png", alt: "Our team" }],
    })
  })

  it("the site default share image applies when a record has none", () => {
    const custom = structuredClone(s)
    custom.settings["seo.defaults"].ogImage = {
      id: "m2",
      url: "/images/banner.png",
      alt: "",
      width: null,
      height: null,
      blurDataUrl: null,
    }
    expect(serviceMetadata(custom, "alarm-responses").openGraph).toMatchObject({
      images: [{ url: "/images/banner.png" }],
    })
  })

  it("services: canonical /services/<slug>, intro as description", () => {
    const service = s.services.find((x) => x.slug === "alarm-responses")!
    const meta = serviceMetadata(s, "alarm-responses")
    expect(meta.alternates).toEqual({ canonical: "/services/alarm-responses" })
    expect(meta.description).toBe(service.content.detail.intro)
    expect(meta.openGraph).toMatchObject({
      type: "website",
      images: [{ url: "/og/service/alarm-responses" }],
    })
    expect(serviceMetadata(s, "nope")).toEqual({})
  })

  it("articles: Open Graph article with published time, section and tags", () => {
    const article = s.articles.find((a) => a.slug === "key-holding-explained")!
    const meta = articleMetadata(s, "key-holding-explained")
    expect(meta.alternates).toEqual({
      canonical: "/blog/key-holding-explained",
    })
    expect(meta.openGraph).toMatchObject({
      type: "article",
      url: "/blog/key-holding-explained",
      section: article.category.name,
      publishedTime: article.publishedAt!.toISOString(),
      images: [{ url: "/og/article/key-holding-explained" }],
    })
    expect(articleMetadata(s, "nope")).toEqual({})
  })

  it("ogTitle/ogDescription override social only; page title unchanged", () => {
    const base = pageMetadata(s, "about")
    const custom = structuredClone(s)
    custom.pages.about.seo = {
      ...custom.pages.about.seo,
      ogTitle: "Social",
      ogDescription: "Social description",
    }
    const meta = pageMetadata(custom, "about")
    expect(meta.title).toBe(base.title)
    expect(meta.description).toBe(base.description)
    expect(meta.openGraph).toMatchObject({
      title: "Social",
      description: "Social description",
    })
    // X shows one coherent card: the social title, like og:title.
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Social",
      description: "Social description",
    })
  })

  it("blank ogTitle/ogDescription fall back to the page title and description", () => {
    const base = pageMetadata(s, "about")
    const custom = structuredClone(s)
    custom.pages.about.seo = {
      ...custom.pages.about.seo,
      ogTitle: "  ",
      ogDescription: "",
    }
    const meta = pageMetadata(custom, "about")
    expect(meta.openGraph).toMatchObject({
      title: base.title,
      description: base.description,
    })
    expect(meta.twitter).toMatchObject({
      title: base.title,
      description: base.description,
    })
  })

  it("without social overrides twitter:title is the page title (unchanged)", () => {
    for (const meta of [
      pageMetadata(s, "home"),
      pageMetadata(s, "about"),
      serviceMetadata(s, "alarm-responses"),
      articleMetadata(s, "key-holding-explained"),
    ])
      expect(meta.twitter).toMatchObject({ title: meta.title })
  })

  it("social fields fill {placeholders} like the own fields", () => {
    const custom = structuredClone(s)
    custom.pages.about.seo = {
      ...custom.pages.about.seo,
      ogTitle: "Call {phone24h}",
    }
    const meta = pageMetadata(custom, "about")
    expect(meta.openGraph).toMatchObject({
      title: interpolate("Call {phone24h}", placeholders(s)),
    })
    expect((meta.openGraph as { title: string }).title).not.toContain("{")
  })

  it("twitterCard summary", () => {
    const custom = structuredClone(s)
    custom.articles[0].seo = {
      ...custom.articles[0].seo,
      twitterCard: "summary",
    }
    expect(
      articleMetadata(custom, custom.articles[0].slug).twitter
    ).toMatchObject({ card: "summary" })
  })

  it("siteMetadata: metadataBase is the origin, default description for pages without one", () => {
    const meta = siteMetadata(s, "https://www.securitypartnersltd.com")
    expect(meta.metadataBase?.toString()).toBe(
      "https://www.securitypartnersltd.com/"
    )
    expect(meta.description).toBe(defaults.description)
  })

  it("siteMetadata: favicon falls back to /favicon.ico when unset", () => {
    expect(s.settings.site.favicon).toBeNull()
    const meta = siteMetadata(s, "https://www.securitypartnersltd.com")
    expect(meta.icons).toEqual({ icon: "/favicon.ico" })
  })

  it("siteMetadata: settings.site.favicon becomes the browser tab icon", () => {
    const custom = structuredClone(s)
    custom.settings.site.favicon = {
      ...custom.settings.site.logo,
      url: "/api/v1/media/file/uploads/icon.png",
    }
    const meta = siteMetadata(custom, "https://www.securitypartnersltd.com")
    expect(meta.icons).toEqual({ icon: "/api/v1/media/file/uploads/icon.png" })
  })

  it("siteMetadata (seeded): no robots and no verification keys", () => {
    const meta = siteMetadata(s, "https://www.securitypartnersltd.com")
    expect(Object.keys(meta).sort()).toEqual([
      "description",
      "icons",
      "metadataBase",
    ])
  })

  it("siteMetadata: site-wide noindex → robots index:false, follow:false", () => {
    const custom = structuredClone(s)
    custom.settings["seo.defaults"].robots = "noindex"
    const meta = siteMetadata(custom, "https://www.securitypartnersltd.com")
    expect(meta.robots).toEqual({ index: false, follow: false })
    // Pages keep their own metadata (the root robots is inherited).
    expect(pageMetadata(custom, "home").robots).toBeUndefined()
  })

  it("siteMetadata: verification tokens only when non-empty", () => {
    const custom = structuredClone(s)
    custom.settings["seo.defaults"].verification = { google: "g-123", bing: "" }
    expect(
      siteMetadata(custom, "https://www.securitypartnersltd.com").verification
    ).toEqual({ google: "g-123" })
    custom.settings["seo.defaults"].verification = { google: "", bing: "B_9" }
    expect(
      siteMetadata(custom, "https://www.securitypartnersltd.com").verification
    ).toEqual({ other: { "msvalidate.01": "B_9" } })
    custom.settings["seo.defaults"].verification = {
      google: "g-123",
      bing: "B_9",
    }
    expect(
      siteMetadata(custom, "https://www.securitypartnersltd.com").verification
    ).toEqual({ google: "g-123", other: { "msvalidate.01": "B_9" } })
  })

  it("siteMetadata: a pre-migration seo.defaults row keeps the base metadata (D1.6 M1)", () => {
    const custom = structuredClone(s)
    const legacy = custom.settings["seo.defaults"] as Partial<
      (typeof custom.settings)["seo.defaults"]
    >
    delete legacy.verification
    delete legacy.robots
    const meta = siteMetadata(custom, "https://www.securitypartnersltd.com")
    expect(Object.keys(meta).sort()).toEqual([
      "description",
      "icons",
      "metadataBase",
    ])
    expect(String(meta.metadataBase)).toBe(
      "https://www.securitypartnersltd.com/"
    )
    expect(meta.description).toBe(
      interpolate(defaults.description, placeholders(s))
    )
  })
})
