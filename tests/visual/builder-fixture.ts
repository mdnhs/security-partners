import { eq } from "drizzle-orm"

import { type BuilderDocument, validateDocument } from "@/blocks/document"
import type { DbOrTx } from "@/server/db/client"
import { builderPages, pages } from "@/server/db/schema"

import { VISUAL_BUILDER_SLUG } from "./builder-slug"

// /p/visual-fixture (tests/visual/builder-pages.spec.ts): one published
// builder page with every block except newsletter (D4 renders that one).
// Visual runs only — never `pnpm db:seed`. Media come from the seeded
// fixed pages, so the screenshots use the same images as the site.

export { VISUAL_BUILDER_SLUG }

type MediaRef = { mediaId: string }

async function publishedData<T>(db: DbOrTx, key: string): Promise<T> {
  const [row] = await db
    .select({ published: pages.published })
    .from(pages)
    .where(eq(pages.key, key))
  if (!row?.published) throw new Error(`[visual] page ${key} not seeded`)
  return row.published as T
}

export async function visualBuilderDocument(
  db: DbOrTx
): Promise<BuilderDocument> {
  const about = await publishedData<{
    hero: { image: MediaRef }
    values: { items: { icon: MediaRef }[] }
  }>(db, "about")
  const contact = await publishedData<{
    departments: { items: { icon: MediaRef }[] }
  }>(db, "contact")
  const doc: BuilderDocument = {
    blocks: [
      {
        id: "visual-hero",
        type: "hero.page",
        anchor: "hero-page",
        hidden: false,
        data: {
          image: about.hero.image,
          crumb: "Visual fixture",
          title: "Every block on one page",
          description:
            "A builder page made only of the existing public sections.",
        },
      },
      {
        id: "visual-about",
        type: "about",
        anchor: "about",
        hidden: false,
        data: { useShared: true },
      },
      {
        id: "visual-stats",
        type: "stats",
        anchor: "stats",
        hidden: false,
        data: {
          items: [
            {
              value: "18+",
              label: "Years",
              description: "Watching over Irish businesses.",
            },
            {
              value: "24/7",
              label: "Operations",
              description: "A control room that never closes.",
            },
          ],
        },
      },
      {
        id: "visual-cards",
        type: "iconCards",
        anchor: "icon-cards",
        hidden: false,
        data: {
          eyebrow: "Our values",
          title: "What we stand for",
          description: "Three promises behind every assignment.",
          items: [
            {
              title: "Reliability",
              description: "We turn up, every time.",
              icon: about.values.items[0].icon,
            },
            {
              title: "Integrity",
              description: "Honest reports and clear pricing.",
              icon: about.values.items[1].icon,
            },
            {
              title: "Vigilance",
              description: "Trained officers who notice more.",
              icon: about.values.items[2].icon,
            },
          ],
        },
      },
      {
        id: "visual-services",
        type: "services",
        anchor: "services",
        hidden: false,
        data: {
          eyebrow: "Services",
          heading: "What we do",
          intro: "Security services for every kind of site.",
          count: 3,
        },
      },
      {
        id: "visual-why",
        type: "whyChooseUs",
        anchor: "why-choose-us",
        hidden: false,
        data: { useShared: true },
      },
      {
        id: "visual-banner",
        type: "enquireBanner",
        anchor: "enquire-banner",
        hidden: false,
        data: { useShared: true },
      },
      {
        id: "visual-clients",
        type: "clients",
        anchor: "clients",
        hidden: false,
        data: { useShared: true },
      },
      {
        id: "visual-team",
        type: "team",
        anchor: "team",
        hidden: false,
        data: {
          heading: "The people behind the service",
          intro: "Experienced leaders, available when you need them.",
        },
      },
      {
        id: "visual-blog",
        type: "blog",
        anchor: "blog",
        hidden: false,
        data: {
          heading: "Latest from the blog",
          intro: "News and advice from our team.",
          count: 3,
        },
      },
      {
        id: "visual-departments",
        type: "departments",
        anchor: "departments",
        hidden: false,
        data: {
          eyebrow: "Departments",
          heading: "Talk to the right team",
          intro: "Direct lines to the people who can help.",
          items: [
            {
              title: "Operations",
              icon: contact.departments.items[0].icon,
              name: "Operations desk",
              role: "Control room",
              lines: [{ text: "Tel: {office}", href: "{officeHref}" }],
            },
          ],
        },
      },
      {
        id: "visual-contact",
        type: "contact",
        anchor: "contact",
        hidden: false,
        data: { useShared: true },
      },
      {
        id: "visual-map",
        type: "map",
        anchor: "map",
        hidden: false,
        data: { useShared: true },
      },
      {
        id: "visual-text",
        type: "richtext",
        anchor: "text",
        hidden: false,
        data: {
          doc: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "Formatted text" }],
              },
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Body copy with " },
                  { type: "text", text: "bold", marks: [{ type: "bold" }] },
                  { type: "text", text: " words." },
                ],
              },
            ],
          },
        },
      },
      {
        id: "visual-hidden",
        type: "stats",
        anchor: "hidden-stats",
        hidden: true,
        data: {
          items: [
            { value: "0", label: "Hidden", description: "Never rendered." },
          ],
        },
      },
    ],
  }
  const result = validateDocument(doc)
  if (!result.ok)
    throw new Error(
      `[visual] builder fixture invalid: ${JSON.stringify(result.fieldErrors)}`
    )
  return result.doc
}

/**
 * Inserts the published /p/visual-fixture page. No media_usages rows: the
 * public render does not read them, and the admin baselines (media usage
 * counts) stay exactly as the content seed leaves them.
 */
export async function seedVisualBuilderPage(db: DbOrTx): Promise<void> {
  const doc = await visualBuilderDocument(db)
  await db.insert(builderPages).values({
    slug: VISUAL_BUILDER_SLUG,
    title: "Visual fixture",
    draft: doc,
    published: doc,
    status: "published",
    publishedAt: new Date("2026-10-01T09:00:00Z"),
  })
}
