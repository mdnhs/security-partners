// The eight SEO checks (spec §7.1). Pure and isomorphic: the server's SEO
// health (server/modules/seo/service.ts) and the editors' live checklist
// run the same rules.

import { isShareImageSize } from "./share-image"

export const SEO_CHECKS = [
  "title-length",
  "title-unique",
  "description",
  "og-image",
  "alt-text",
  "h1",
  "indexable",
  "internal-link",
] as const
export type SeoCheckId = (typeof SEO_CHECKS)[number]
export const SEO_CHECK_COUNT = SEO_CHECKS.length

/** Recommended lengths in characters, inclusive. */
export const TITLE_RANGE = [30, 60] as const
export const DESCRIPTION_RANGE = [70, 160] as const

export type CheckInput = {
  /** The effective <title>. */
  title: string
  /** No other published record has the same title (trimmed, case-insensitive). */
  titleUnique: boolean
  /** The effective description; null or blank when there is none. */
  description: string | null
  usesDefaultDescription: boolean
  /** The effective share image's size; null = the generated card (passes). */
  ogImage: { width: number; height: number } | null
  /** Images used by the record with no alt text that are not decorative. */
  imagesMissingAlt: number
  hasH1: boolean
  noindex: boolean
  /** The site robots mode is noindex (SEO › Defaults). */
  siteNoindex: boolean
  /** Site-relative links in the record's rich text; null = no rich text (passes). */
  internalLinks: number | null
}

export type CheckResult = { id: SeoCheckId; ok: boolean; message: string }

const length = (text: string) => [...text].length

const inRange = (n: number, [min, max]: readonly [number, number]) =>
  n >= min && n <= max

/** `{n} image(s) missing alt text` (alt-text check; also the media issue). */
export const altTextMessage = (n: number) => `${n} image(s) missing alt text`

function description(input: CheckInput): { ok: boolean; message: string } {
  const [min, max] = DESCRIPTION_RANGE
  if (input.description === null || input.description.trim() === "")
    return { ok: false, message: "Add a meta description" }
  if (input.usesDefaultDescription)
    return { ok: false, message: "Uses the site-wide default description" }
  const n = length(input.description)
  return {
    ok: inRange(n, DESCRIPTION_RANGE),
    message: `Description is ${n} characters (aim for ${min}–${max})`,
  }
}

/** Every check's result, in SEO_CHECKS order. */
export function runChecks(input: CheckInput): CheckResult[] {
  const [titleMin, titleMax] = TITLE_RANGE
  const t = length(input.title)
  const og = input.ogImage
  const results: Record<SeoCheckId, { ok: boolean; message: string }> = {
    "title-length": {
      ok: inRange(t, TITLE_RANGE),
      message: `Title is ${t} characters (aim for ${titleMin}–${titleMax})`,
    },
    "title-unique": input.titleUnique
      ? { ok: true, message: "No other page uses this title" }
      : { ok: false, message: "Another page uses the same title" },
    description: description(input),
    "og-image":
      og === null || isShareImageSize(og.width, og.height)
        ? {
            ok: true,
            message:
              og === null
                ? "Uses the generated share card"
                : "Share image is at least 1200×630 (1.91:1)",
          }
        : {
            ok: false,
            message: "Share image should be at least 1200×630 (1.91:1)",
          },
    "alt-text":
      input.imagesMissingAlt > 0
        ? { ok: false, message: altTextMessage(input.imagesMissingAlt) }
        : { ok: true, message: "Every image has alt text" },
    h1: input.hasH1
      ? { ok: true, message: "Has a main heading (H1)" }
      : { ok: false, message: "No main heading (H1)" },
    indexable: input.siteNoindex
      ? {
          ok: false,
          message:
            "The whole site is hidden from search engines (SEO › Defaults)",
        }
      : input.noindex
        ? { ok: false, message: "Hidden from search engines" }
        : { ok: true, message: "Visible to search engines" },
    "internal-link":
      input.internalLinks === 0
        ? { ok: false, message: "No links to other pages on this site" }
        : {
            ok: true,
            message:
              input.internalLinks === null
                ? "No text to link from"
                : "Links to other pages on this site",
          },
  }
  return SEO_CHECKS.map((id) => ({ id, ...results[id] }))
}
