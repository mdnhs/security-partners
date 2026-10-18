import { Editor } from "@tiptap/core"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

import { richTextExtensions } from "@/components/admin/rich-text/extensions"
import { type MediaView, replaceMediaRefs } from "@/lib/media"
import { ArticleBlocks } from "@/lib/rich-text/render"
import { type RichTextDoc, richText } from "@/lib/schemas/common"
import { articlesFixture } from "@/server/db/seed/fixtures/articles"
import {
  fixtureMediaKey,
  fixtureMediaLookup,
} from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"

const staticMedia = (id: string): MediaView => ({
  id,
  url: fixtureMediaKey(id),
  alt: "",
  width: null,
  height: null,
  blurDataUrl: null,
})

const html = (doc: RichTextDoc) =>
  renderToStaticMarkup(
    <ArticleBlocks doc={replaceMediaRefs(doc, staticMedia)} />
  )

let editors: Editor[] = []
afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
})

/** What the admin editor stores after loading `content` (HTML = a paste). */
function throughEditor(content: RichTextDoc | string) {
  const editor = new Editor({
    extensions: richTextExtensions("full"),
    content,
  })
  editors.push(editor)
  return editor.getJSON()
}

const pages = pagesFixture(fixtureMediaLookup)
const seededBodies: [string, RichTextDoc][] = [
  ...articlesFixture(fixtureMediaLookup).flatMap((a) =>
    a.content.body ? [[a.slug, a.content.body] as [string, RichTextDoc]] : []
  ),
  ["privacy", pages.privacy.data.body],
  ["terms", pages.terms.data.body],
]

describe("editor ↔ public renderer (master 5.2)", () => {
  it("covers the seeded article body", () => {
    expect(seededBodies.map(([name]) => name)).toContain(
      "mobile-patrols-protect-your-business-after-hours"
    )
  })

  it.each(seededBodies)(
    "%s: opening and saving it in the editor changes nothing on the site",
    (_name, stored) => {
      const saved = richText.parse(throughEditor(stored))
      expect(html(saved)).toBe(html(stored))
    }
  )

  it("pasting the public article's own HTML gives a valid doc with its text", () => {
    const article = articlesFixture(fixtureMediaLookup).find(
      (a) => a.slug === "mobile-patrols-protect-your-business-after-hours"
    )!
    const pasted = throughEditor(html(article.content.body!))
    const parsed = richText.safeParse(pasted)
    expect(parsed.success).toBe(true)
    const serialized = JSON.stringify(pasted)
    expect(serialized).toContain("What a scheduled patrol covers")
    expect(serialized).toContain(
      "Tag point checks logged at every stop, in real time"
    )
    expect(serialized).toContain("Security Partners Operations Team")
    // Public <img> tags carry no library id: no image node survives.
    expect(serialized).not.toContain('"type":"image"')
    const lists = parsed.data!.content.filter((b) => b.type === "bulletList")
    expect(lists).toHaveLength(1)
    expect(lists[0].type === "bulletList" && lists[0].content).toHaveLength(4)
  })

  it("an image node renders the library file it references", () => {
    const hero = fixtureMediaLookup("/images/hero.jpg")
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        { type: "image", attrs: { media: hero, alt: "Officer on patrol" } },
      ],
    }
    const stored = richText.parse(throughEditor(doc))
    expect(stored.content[0]).toEqual({
      type: "image",
      attrs: { media: { mediaId: hero.mediaId }, alt: "Officer on patrol" },
    })
    const markup = html(stored)
    expect(markup).toContain('alt="Officer on patrol"')
    expect(markup).toContain(encodeURIComponent("/images/hero.jpg"))
  })

  it("drops placeholder and unsafe link targets on paste, keeps safe ones", () => {
    const json = JSON.stringify(
      throughEditor(
        '<p><a href="{phone24hHref}">call</a> <a href="tel:{phone24h}">now</a> <a href="/contact">contact</a></p>'
      )
    )
    expect(json).not.toContain("{phone24h")
    expect(json).toContain('"href":"/contact"')
  })
})
