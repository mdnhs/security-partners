import { describe, expect, it } from "vitest"

import { DraftDocument, validateDocument } from "@/blocks/document"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import {
  blocksFromTemplate,
  copySlug,
  copyTitle,
} from "@/templates/builder/from-template"
import { PAGE_KEYS, type PageData } from "@/templates/registry"

const fixture = { pages: pagesFixture(fixtureMediaLookup) }
const types = (key: (typeof PAGE_KEYS)[number]) =>
  blocksFromTemplate(key, fixture.pages[key].data).blocks.map((b) => b.type)

describe("blocksFromTemplate", () => {
  it("blocksFromTemplate(about) yields hero.page, about, stats, iconCards with the template's copy", () => {
    const data = fixture.pages.about.data
    const doc = blocksFromTemplate("about", data)
    const [hero, about, stats, values] = doc.blocks
    expect(doc.blocks.slice(0, 4).map((b) => b.type)).toEqual([
      "hero.page",
      "about",
      "stats",
      "iconCards",
    ])
    expect(hero.data).toEqual({
      image: data.hero.image,
      crumb: data.hero.crumb,
      title: data.hero.title,
      description: data.hero.description,
    })
    expect(about).toMatchObject({ anchor: "about", data: { useShared: true } })
    expect(stats.data).toEqual({ items: data.stats })
    expect(values.data).toEqual({
      eyebrow: data.values.eyebrow,
      title: data.values.title,
      description: data.values.description,
      items: data.values.items,
    })
  })

  it("every fixed page converts to a document that passes validateDocument", () => {
    for (const k of PAGE_KEYS) {
      const result = validateDocument(
        blocksFromTemplate(k, fixture.pages[k].data)
      )
      expect(result.ok ? true : result.fieldErrors, k).toBe(true)
      // …and to a seed the create route accepts (DraftDocument).
      expect(
        DraftDocument.safeParse(blocksFromTemplate(k, fixture.pages[k].data))
          .success,
        k
      ).toBe(true)
    }
  })

  it("follows each fixed page's section order", () => {
    expect(types("home")).toEqual([
      "hero.page",
      "about",
      "services",
      "enquireBanner",
      "clients",
      "team",
      "blog",
      "contact",
      "map",
    ])
    expect(types("about")).toEqual([
      "hero.page",
      "about",
      "stats",
      "iconCards",
      "clients",
      "enquireBanner",
    ])
    expect(types("services")).toEqual([
      "hero.page",
      "services",
      "whyChooseUs",
      "clients",
      "enquireBanner",
    ])
    expect(types("team")).toEqual([
      "hero.page",
      "team",
      "iconCards",
      "enquireBanner",
    ])
    expect(types("blog")).toEqual(["hero.page", "blog", "enquireBanner"])
    expect(types("contact")).toEqual([
      "hero.page",
      "contact",
      "departments",
      "map",
    ])
    expect(types("privacy")).toEqual(["hero.page", "richtext"])
    expect(types("terms")).toEqual(["hero.page", "richtext"])
  })

  it("home: the home hero becomes a page hero (image, heading → title, subheading → description)", () => {
    const data = fixture.pages.home.data
    const [hero, , services, , , team, blog] = blocksFromTemplate(
      "home",
      data
    ).blocks
    expect(hero.data).toMatchObject({
      image: data.hero.backgroundImage,
      title: data.hero.heading,
      description: data.hero.subheading,
    })
    expect(services.data).toEqual({ ...data.services, count: 12 })
    expect(team.data).toEqual({
      heading: data.team.heading,
      intro: data.team.intro,
    })
    expect(blog.data).toMatchObject({
      heading: data.blog.heading,
      intro: data.blog.intro,
      count: Math.min(data.blog.count, 6),
    })
  })

  it("owning blocks keep their section ids; ids and anchors are unique", () => {
    for (const k of PAGE_KEYS) {
      const { blocks } = blocksFromTemplate(k, fixture.pages[k].data)
      expect(new Set(blocks.map((b) => b.id)).size, k).toBe(blocks.length)
      expect(new Set(blocks.map((b) => b.anchor)).size, k).toBe(blocks.length)
      for (const b of blocks)
        if (["about", "services", "team", "blog", "contact"].includes(b.type))
          expect(b.anchor).toBe(b.type)
    }
  })

  it("copy that is longer than a block allows is cut to fit, lists to the block's maximum", () => {
    const data = structuredClone(fixture.pages.about.data) as PageData<"about">
    data.hero.title = "x".repeat(200)
    data.stats = Array.from({ length: 7 }, (_, i) => ({
      value: `${i}`,
      label: "l",
      description: "d",
    }))
    data.values.items = Array.from({ length: 9 }, () => data.values.items[0])
    const doc = blocksFromTemplate("about", data)
    expect(validateDocument(doc).ok).toBe(true)
    expect((doc.blocks[0].data as { title: string }).title).toHaveLength(80)
    expect((doc.blocks[2].data as { items: unknown[] }).items).toHaveLength(4)
    expect((doc.blocks[3].data as { items: unknown[] }).items).toHaveLength(6)
  })

  it("does not share objects with the template data", () => {
    const data = fixture.pages.about.data
    const doc = blocksFromTemplate("about", data)
    expect(doc.blocks[0].data).not.toBe(data.hero)
    expect((doc.blocks[0].data as { image: unknown }).image).not.toBe(
      data.hero.image
    )
  })
})

describe("copy names", () => {
  it("copyTitle / copySlug suggest '<label> copy' and '<key>-copy'", () => {
    expect(copyTitle("About")).toBe("About copy")
    expect(copySlug("about")).toBe("about-copy")
  })
})
