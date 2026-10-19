import { z } from "zod"

import { contactTemplate } from "@/templates/contact/schema"

import { defineBlock } from "./define-block"
import {
  count,
  iconCard,
  mediaRef,
  richText,
  sectionCopy,
  sharedOnly,
  text,
} from "./fields"

// One block per existing public section (spec §7.5). The renderer maps each
// to its component through templates/shared/views.ts; API validation, the
// admin library and the types all read this list.

const heroPage = defineBlock({
  type: "hero.page",
  label: "Page hero",
  icon: "PanelTop",
  description: "Banner image with breadcrumb, title and intro.",
  schema: z.object({
    image: mediaRef,
    crumb: text(40),
    title: text(80),
    description: text(240),
  }),
  defaults: { crumb: "", title: "", description: "" },
  first: true,
  max: 1,
})

const about = defineBlock({
  type: "about",
  label: "About",
  icon: "Info",
  description: "The About section from Settings › Sections.",
  schema: z.object({ useShared: z.boolean() }),
  defaults: { useShared: true },
  max: 1,
})

const stats = defineBlock({
  type: "stats",
  label: "Stats",
  icon: "ChartColumn",
  description: "Up to four figures with a label and a short note.",
  schema: z.object({
    items: z
      .array(
        z.object({
          value: text(12),
          label: text(40),
          description: text(160),
        })
      )
      .min(1)
      .max(4),
  }),
  defaults: { items: [{ value: "", label: "", description: "" }] },
})

const iconCards = defineBlock({
  type: "iconCards",
  label: "Icon cards",
  icon: "LayoutGrid",
  description: "A heading with up to six icon, title and text cards.",
  schema: z.object({
    eyebrow: text(40),
    title: text(80),
    description: text(240),
    items: z.array(iconCard).min(1).max(6),
  }),
  defaults: { eyebrow: "", title: "", description: "", items: [] },
})

const services = defineBlock({
  type: "services",
  label: "Services",
  icon: "BriefcaseBusiness",
  description: "Cards for the published services.",
  schema: z.object({ ...sectionCopy, count: count(12) }),
  defaults: { eyebrow: "", heading: "", intro: "", count: 6 },
  max: 1,
})

const whyChooseUs = defineBlock({
  type: "whyChooseUs",
  label: "Why choose us",
  icon: "ShieldCheck",
  description: "The shared Why choose us section.",
  schema: sharedOnly,
  defaults: { useShared: true },
  max: 1,
})

const enquireBanner = defineBlock({
  type: "enquireBanner",
  label: "Enquire banner",
  icon: "Megaphone",
  description: "The shared call-to-action banner.",
  schema: sharedOnly,
  defaults: { useShared: true },
  max: 1,
})

const clients = defineBlock({
  type: "clients",
  label: "Clients",
  icon: "Handshake",
  description: "The shared client logo strip.",
  schema: sharedOnly,
  defaults: { useShared: true },
  max: 1,
})

const team = defineBlock({
  type: "team",
  label: "Team",
  icon: "Users",
  description: "The published team members.",
  schema: z.object({ heading: text(80), intro: text(240) }),
  defaults: { heading: "", intro: "" },
  max: 1,
})

const blog = defineBlock({
  type: "blog",
  label: "Blog",
  icon: "Newspaper",
  description: "The latest published articles.",
  schema: z.object({ heading: text(80), intro: text(240), count: count(6) }),
  defaults: { heading: "", intro: "", count: 3 },
  max: 1,
})

const contactDepartments = contactTemplate.shape.departments
const departments = defineBlock({
  type: "departments",
  label: "Departments",
  icon: "Building2",
  description: "Up to six department contact cards.",
  schema: contactDepartments.extend({
    items: contactDepartments.shape.items.max(6),
  }),
  defaults: { eyebrow: "", heading: "", intro: "", items: [] },
})

const contact = defineBlock({
  type: "contact",
  label: "Contact",
  icon: "Contact",
  description: "Contact details and the enquiry form.",
  schema: sharedOnly,
  defaults: { useShared: true },
  max: 1,
})

const map = defineBlock({
  type: "map",
  label: "Map",
  icon: "MapPin",
  description: "The shared location map.",
  schema: sharedOnly,
  defaults: { useShared: true },
  max: 1,
})

const richtext = defineBlock({
  type: "richtext",
  label: "Text",
  icon: "Type",
  description: "Formatted text: headings, lists, quotes and images.",
  schema: z.object({ doc: richText }),
  defaults: {},
})

const newsletter = defineBlock({
  type: "newsletter",
  label: "Newsletter",
  icon: "MailPlus",
  description: "The newsletter sign-up form.",
  schema: sharedOnly,
  defaults: { useShared: true },
  max: 1,
})

export const BLOCKS = [
  heroPage,
  about,
  stats,
  iconCards,
  services,
  whyChooseUs,
  enquireBanner,
  clients,
  team,
  blog,
  departments,
  contact,
  map,
  richtext,
  newsletter,
] as const

type AnyBlock = (typeof BLOCKS)[number]
export type BlockType = AnyBlock["type"]

export const BLOCK_TYPES = BLOCKS.map((block) => block.type) as [
  BlockType,
  ...BlockType[],
]

export const BLOCK_BY_TYPE = Object.fromEntries(
  BLOCKS.map((block) => [block.type, block])
) as { [B in AnyBlock as B["type"]]: B }

/** Stable across edits; the builder mints crypto.randomUUID(). */
export const BlockId = z.string().regex(/^[A-Za-z0-9_-]{4,48}$/)

/** The section's id on the page (unique per page, blocks/document.ts). */
export const Anchor = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]{0,39}$/,
    "Use up to 40 lower-case letters, digits and hyphens, starting with a letter"
  )

const instance = <const T extends string, S extends z.ZodType>(block: {
  type: T
  schema: S
}) =>
  z.object({
    id: BlockId,
    type: z.literal(block.type),
    anchor: Anchor,
    hidden: z.boolean(),
    data: block.schema,
  })

export const BlockInstance = z.discriminatedUnion("type", [
  instance(heroPage),
  instance(about),
  instance(stats),
  instance(iconCards),
  instance(services),
  instance(whyChooseUs),
  instance(enquireBanner),
  instance(clients),
  instance(team),
  instance(blog),
  instance(departments),
  instance(contact),
  instance(map),
  instance(richtext),
  instance(newsletter),
])
export type BlockInstance = z.infer<typeof BlockInstance>
export type BlockData<T extends BlockType> = Extract<
  BlockInstance,
  { type: T }
>["data"]

// Compile error if BLOCKS and BlockInstance drift apart.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
export const _blockTypesInSync: Exact<BlockInstance["type"], BlockType> = true
