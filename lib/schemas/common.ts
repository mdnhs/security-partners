import { z } from "zod"

import { CONTROL_CHAR, isSafeHref, isSafeRichTextHref } from "../href"
import { linkPlaceholderProblems } from "../link-rules"

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

/** Internal path, #anchor, http(s), tel:, mailto: or a {placeholder}. Never javascript: or //host. */
export { isSafeHref }

export const href = z
  .string()
  .min(1, "Required")
  .max(2000)
  .refine(
    isSafeHref,
    "Use /path, #anchor, https://…, tel:, mailto: or {placeholder}"
  )

/**
 * Button/link copy and destination. {placeholders} must be Settings › Contact
 * names, and a whole-value href must be a URL one (lib/link-rules.ts).
 */
export const link = z
  .object({ label: text, href })
  .superRefine((value, ctx) => {
    for (const [key, message] of Object.entries(linkPlaceholderProblems(value)))
      ctx.addIssue({ code: "custom", path: [key], message })
  })

/** Absolute http(s) URL only (never javascript:, data:, ftp:…), no control characters. */
export const httpUrl = z
  .url({ protocol: /^https?$/ })
  .refine((value) => !CONTROL_CHAR.test(value), {
    message: "Must not contain control characters",
  })

/** Reference to a row in the media library (resolved to a URL at render). */
export const mediaRef = z.object({ mediaId: z.uuid() })

/** A link target inside rich text: like `href`, but never a {placeholder}. */
const richTextHref = z
  .string()
  .min(1, "Required")
  .max(2000)
  .refine(
    isSafeRichTextHref,
    "Use /path, #anchor, https://…, tel: or mailto: ({placeholders} do not work inside formatted text)"
  )

// Rich text: TipTap JSON restricted to what the article design renders
// (spec §5.3). Unknown attributes are stripped on parse.
const mark = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({ href: richTextHref }),
  }),
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
  // z.url() normalises (drops tabs/newlines, encodes spaces): check the raw
  // text first so a pasted value is refused, never silently rewritten.
  canonical: z
    .string()
    .max(2000)
    .refine((value) => !/[\s\u0000-\u001f\u007f]/.test(value), {
      message: "Remove spaces and line breaks from the address",
    })
    .pipe(httpUrl)
    .optional(),
  ogImage: mediaRef.optional(),
  noindex: z.boolean().optional(),
  // Social sharing overrides: blank falls back to title/description.
  ogTitle: z.string().max(70).optional(),
  ogDescription: z.string().max(200).optional(),
  twitterCard: z.enum(["summary_large_image", "summary"]).optional(),
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
