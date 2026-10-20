import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// SiteHeader marks the active link from the router's pathname.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/p/landing",
}))

import { BLOCK_TYPES } from "@/blocks/registry"
import type { MediaView } from "@/lib/media"
import { toPublicCopy } from "@/lib/schemas/settings/newsletter"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { BuilderTemplate } from "@/templates/builder/render"
import {
  blockView,
  builderBlocksView,
  type ResolvedBlock,
} from "@/templates/builder/views"
import { builderPageMetadata } from "@/templates/shared/page-meta"
import { aboutSectionView, chromeView } from "@/templates/shared/views"

const s = fixtureSiteSources()

const media = (id: string, url = `/media/${id}.png`): MediaView => ({
  id,
  url,
  alt: "",
  width: 64,
  height: 64,
  blurDataUrl: null,
})

const richDoc = {
  type: "doc" as const,
  content: [
    {
      type: "heading" as const,
      attrs: { level: 2 as const },
      content: [{ type: "text" as const, text: "Our promise" }],
    },
    {
      type: "paragraph" as const,
      content: [{ type: "text" as const, text: "Plain words." }],
    },
  ],
}

/** One instance of every block type, media already resolved. */
const ALL: ResolvedBlock[] = [
  {
    id: "b-hero",
    type: "hero.page",
    anchor: "hero-page",
    hidden: false,
    data: {
      image: media("hero", "/media/hero.png"),
      crumb: "Landing",
      title: "Call {office}",
      description: "Guarding across Ireland.",
    },
  },
  {
    id: "b-about",
    type: "about",
    anchor: "about",
    hidden: false,
    data: { useShared: true },
  },
  {
    id: "b-stats",
    type: "stats",
    anchor: "stats",
    hidden: false,
    data: { items: [{ value: "24/7", label: "Cover", description: "Always" }] },
  },
  {
    id: "b-cards",
    type: "iconCards",
    anchor: "icon-cards",
    hidden: false,
    data: {
      eyebrow: "Values",
      title: "What we stand for",
      description: "Three things.",
      items: [{ title: "Trust", description: "Kept.", icon: media("ic1") }],
    },
  },
  {
    id: "b-services",
    type: "services",
    anchor: "services",
    hidden: false,
    data: {
      eyebrow: "Services",
      heading: "What we do",
      intro: "All",
      count: 2,
    },
  },
  {
    id: "b-why",
    type: "whyChooseUs",
    anchor: "why-choose-us",
    hidden: false,
    data: { useShared: true },
  },
  {
    id: "b-banner",
    type: "enquireBanner",
    anchor: "enquire-banner",
    hidden: false,
    data: { useShared: true },
  },
  {
    id: "b-clients",
    type: "clients",
    anchor: "clients",
    hidden: false,
    data: { useShared: true },
  },
  {
    id: "b-team",
    type: "team",
    anchor: "team",
    hidden: false,
    data: { heading: "Leadership", intro: "The people." },
  },
  {
    id: "b-blog",
    type: "blog",
    anchor: "blog",
    hidden: false,
    data: { heading: "News", intro: "Latest.", count: 1 },
  },
  {
    id: "b-deps",
    type: "departments",
    anchor: "departments",
    hidden: false,
    data: {
      eyebrow: "Departments",
      heading: "Who to call",
      intro: "Direct lines.",
      items: [
        {
          title: "Operations",
          icon: media("dep"),
          name: "Ann",
          role: "Lead",
          lines: [{ text: "Tel {office}", href: "tel:{office}" }],
        },
      ],
    },
  },
  {
    id: "b-contact",
    type: "contact",
    anchor: "contact",
    hidden: false,
    data: { useShared: true },
  },
  {
    id: "b-map",
    type: "map",
    anchor: "map",
    hidden: false,
    data: { useShared: true },
  },
  {
    id: "b-text",
    type: "richtext",
    anchor: "text",
    hidden: false,
    data: { doc: richDoc },
  },
  {
    id: "b-news",
    type: "newsletter",
    anchor: "newsletter",
    hidden: false,
    data: { useShared: true },
  },
]

describe("blockView: every block maps to its existing component's props", () => {
  it("covers every registered block type", () => {
    expect(ALL.map((b) => b.type).sort()).toEqual([...BLOCK_TYPES].sort())
    for (const block of ALL) expect(blockView(block, s).type).toBe(block.type)
  })

  it("hero.page goes through pageHeroView ({placeholders} filled)", () => {
    const view = blockView(ALL[0], s)
    if (view.type !== "hero.page") throw new Error("hero")
    expect(view.props).toMatchObject({
      image: "/media/hero.png",
      crumb: "Landing",
      title: `Call ${s.settings.contact.office}`,
      homeLabel: s.settings.microcopy.breadcrumb.home,
    })
  })

  it("shared sections read Settings › Sections exactly", () => {
    const about = blockView(ALL[1], s)
    expect(about.props).toEqual(aboutSectionView(s))
    const why = blockView(ALL[5], s)
    if (why.type !== "whyChooseUs") throw new Error("why")
    expect(why.props.heading).toBe(s.settings["sections.whyChooseUs"].heading)
  })

  it("collection blocks honour their count", () => {
    const services = blockView(ALL[4], s)
    if (services.type !== "services") throw new Error("services")
    expect(services.props.services).toHaveLength(2)
    expect(services.props.title).toBe("What we do")
    const blog = blockView(ALL[9], s)
    if (blog.type !== "blog") throw new Error("blog")
    expect(blog.props.posts).toHaveLength(1)
    expect(blog.props.heading).toBe("News")
    expect(blog.props.cta).toEqual({ label: "View All Posts", href: "/blog" })
  })

  it("department lines get {placeholders} and safe hrefs", () => {
    const deps = blockView(ALL[10], s)
    if (deps.type !== "departments") throw new Error("departments")
    expect(deps.props.items[0]).toMatchObject({
      icon: "/media/dep.png",
      lines: [{ text: `Tel ${s.settings.contact.office}` }],
    })
  })
})

describe("BuilderTemplate", () => {
  const render = (blocks: ResolvedBlock[]) =>
    renderToStaticMarkup(
      <BuilderTemplate
        chrome={chromeView(s)}
        blocks={builderBlocksView(blocks, s)}
        newsletterCopy={null}
      />
    )

  it("renders visible blocks in order; hidden ones are absent", () => {
    const blocks = [
      ALL[13],
      { ...ALL[3], hidden: true },
      ALL[2],
      ALL[1],
    ] as ResolvedBlock[]
    const html = render(blocks)
    const text = html.indexOf("Our promise")
    const stats = html.indexOf("24/7")
    const about = html.indexOf('id="about"')
    expect(text).toBeGreaterThan(-1)
    expect(stats).toBeGreaterThan(text)
    expect(about).toBeGreaterThan(stats)
    expect(html).not.toContain("What we stand for")
    expect(html).toContain("<main>")
  })

  it("anchors: a <div id> wrapper only when the section has no such id itself", () => {
    const html = render([ALL[1], { ...ALL[2], anchor: "figures" }])
    // About renders id="about" itself: no duplicate wrapper.
    expect(html.match(/id="about"/g)).toHaveLength(1)
    expect(html).toContain('<div id="figures">')
  })

  it("the newsletter block renders the D4 form with the settings copy, at its anchor", () => {
    const news = ALL.find((b) => b.type === "newsletter")!
    const copy = toPublicCopy(settingsFixture(fixtureMediaLookup).newsletter)
    const withCopy = renderToStaticMarkup(
      <BuilderTemplate
        chrome={chromeView(s)}
        blocks={builderBlocksView([{ ...news, anchor: "join" }], s)}
        newsletterCopy={copy}
      />
    )
    expect(withCopy).toContain('id="join"')
    expect(withCopy).toContain(copy.title)
    expect(withCopy).toContain(copy.button)
    // No copy (settings unreadable): nothing renders for the block.
    expect(render([news])).not.toContain(copy.title)
  })
})

describe("builderPageMetadata", () => {
  const page = {
    id: "0b8f7c2e-3b7a-4c55-9d7e-1f0a2b3c4d5e",
    slug: "landing",
    title: "Landing",
    seo: {},
    firstHeroDescription: "Guarding across Ireland.",
  }

  it("canonical /p/<slug>, record name in the title, generated card by id", () => {
    const meta = builderPageMetadata(s, page)
    expect(meta.alternates).toEqual({ canonical: "/p/landing" })
    expect(String(meta.title)).toContain("Landing")
    expect(meta.description).toBe("Guarding across Ireland.")
    expect(meta.openGraph).toMatchObject({
      url: "/p/landing",
      images: [{ url: `/og/builder/${page.id}` }],
    })
  })

  it("the SEO title and noindex win", () => {
    const meta = builderPageMetadata(s, {
      ...page,
      seo: { title: "Custom title", noindex: true },
    })
    expect(meta.title).toBe("Custom title")
    expect(meta.robots).toEqual({ index: false, follow: true })
  })
})
