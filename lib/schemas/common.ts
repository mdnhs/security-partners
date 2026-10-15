import { z } from "zod"

// Building blocks shared by settings, template and collection schemas.
// Strings are never trimmed or normalised: seeded copy must render
// byte-identical (en-dashes, double spaces, "→", apostrophes).

/** Global constraint: slugs match ^[a-z0-9]+(-[a-z0-9]+)*$. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const slug = z
  .string()
  .max(120)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens")

/** Required editable copy (may contain {placeholders}, see lib/interpolate.ts). */
export const text = z.string().min(1, "Required").max(5000)

/** A whole-value placeholder such as "{phone24hHref}". */
const WHOLE_PLACEHOLDER = /^\{[A-Za-z]\w*\}$/
const ABSOLUTE = /^(https?:\/\/|tel:|mailto:)\S+$/i
const CONTROL_CHAR = /[\u0000-\u001f\u007f-\u009f]/
/** Browsers treat "\" as "/" and skip tabs/newlines: "/\host" and "/\t/host" are protocol-relative. */
const UNSAFE_PREFIX = /[\\\s]/

/** Internal path, #anchor, http(s), tel:, mailto: or a {placeholder}. Never javascript: or //host. */
export function isSafeHref(value: string): boolean {
  if (CONTROL_CHAR.test(value)) return false
  if (UNSAFE_PREFIX.test(value.slice(0, 2))) return false
  if (WHOLE_PLACEHOLDER.test(value)) return true
  if (value.startsWith("/")) return !value.startsWith("//")
  if (value.startsWith("#")) return !/\s/.test(value)
  return ABSOLUTE.test(value)
}

export const href = z
  .string()
  .min(1, "Required")
  .max(2000)
  .refine(
    isSafeHref,
    "Use /path, #anchor, https://…, tel:, mailto: or {placeholder}"
  )

export const link = z.object({ label: text, href })

/** Absolute http(s) URL only (never javascript:, data:, ftp:…). */
export const httpUrl = z.url({ protocol: /^https?$/ })

/** Reference to a row in the media library (resolved to a URL at render). */
export const mediaRef = z.object({ mediaId: z.uuid() })

// Rich text: TipTap JSON restricted to what the article design renders
// (spec §5.3). Unknown attributes are stripped on parse.
const mark = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("link"), attrs: z.object({ href }) }),
])
const textNode = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: z.array(mark).optional(),
})
const hardBreak = z.object({ type: z.literal("hardBreak") })
const inline = z.discriminatedUnion("type", [textNode, hardBreak])
const paragraph = z.object({
  type: z.literal("paragraph"),
  content: z.array(inline).optional(),
})
const heading = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
  content: z.array(inline).optional(),
})
const listItem = z.object({
  type: z.literal("listItem"),
  content: z.array(paragraph).min(1),
})
const bulletList = z.object({
  type: z.literal("bulletList"),
  content: z.array(listItem).min(1),
})
const orderedList = z.object({
  type: z.literal("orderedList"),
  attrs: z.object({ start: z.number().int().min(1) }).optional(),
  content: z.array(listItem).min(1),
})
const blockquote = z.object({
  type: z.literal("blockquote"),
  attrs: z.object({ cite: z.string().nullable() }).optional(),
  content: z.array(paragraph).min(1),
})
const image = z.object({
  type: z.literal("image"),
  attrs: z.object({ media: mediaRef, alt: z.string() }),
})
const block = z.discriminatedUnion("type", [
  paragraph,
  heading,
  bulletList,
  orderedList,
  blockquote,
  image,
])

export const richText = z.object({
  type: z.literal("doc"),
  content: z.array(block).min(1),
})

/** Rich text limited to paragraphs (marks allowed): about copy, service overview. */
export const paragraphsText = z.object({
  type: z.literal("doc"),
  content: z.array(paragraph).min(1),
})

/** The PageHero block of an inner page (image, breadcrumb label, title, intro). */
export const pageHero = z.object({
  image: mediaRef,
  crumb: text,
  title: text,
  description: text,
})

/** Icon + title + description cards (values, officer qualities, features). */
export const iconCard = z.object({
  title: text,
  description: text,
  icon: mediaRef,
})

/** Per page/service/article SEO overrides (Phase 8 adds the UI and fallbacks). */
export const seo = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  canonical: httpUrl.optional(),
  ogImage: mediaRef.optional(),
  noindex: z.boolean().optional(),
})

export type Link = z.infer<typeof link>
export type MediaRef = z.infer<typeof mediaRef>
export type Mark = z.infer<typeof mark>
export type TextNode = z.infer<typeof textNode>
export type InlineNode = z.infer<typeof inline>
export type ParagraphNode = z.infer<typeof paragraph>
export type ListItemNode = z.infer<typeof listItem>
export type RichTextBlock = z.infer<typeof block>
export type RichTextDoc = z.infer<typeof richText>
export type ParagraphsDoc = z.infer<typeof paragraphsText>
export type Seo = z.infer<typeof seo>
export type PageHero = z.infer<typeof pageHero>
export type IconCard = z.infer<typeof iconCard>
