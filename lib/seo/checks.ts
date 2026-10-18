// The SEO overview's checks (admin SEO screen + dashboard "Content health").

export const SEO_CHECKS = [
  "title-length",
  "own-description",
  "description-length",
  "indexable",
] as const
export type SeoCheckId = (typeof SEO_CHECKS)[number]
export const SEO_CHECK_COUNT = SEO_CHECKS.length

export const SEO_LIMITS = {
  titleMin: 15,
  titleMax: 60,
  descriptionMin: 50,
  descriptionMax: 160,
} as const

export type SeoIssue = { check: SeoCheckId; message: string }

const length = (text: string) => [...text].length

/** Problems of one published page's effective SEO, in check order. */
export function seoIssues(input: {
  title: string
  description: string
  usesDefaultDescription: boolean
  noindex: boolean
}): SeoIssue[] {
  const issues: SeoIssue[] = []
  const t = length(input.title)
  if (t < SEO_LIMITS.titleMin || t > SEO_LIMITS.titleMax)
    issues.push({
      check: "title-length",
      message: `Title is ${t} characters; aim for ${SEO_LIMITS.titleMin}–${SEO_LIMITS.titleMax}.`,
    })
  if (input.usesDefaultDescription)
    issues.push({
      check: "own-description",
      message: "Uses the site-wide default description.",
    })
  const d = length(input.description)
  if (d < SEO_LIMITS.descriptionMin || d > SEO_LIMITS.descriptionMax)
    issues.push({
      check: "description-length",
      message: `Description is ${d} characters; aim for ${SEO_LIMITS.descriptionMin}–${SEO_LIMITS.descriptionMax}.`,
    })
  if (input.noindex)
    issues.push({
      check: "indexable",
      message: "Hidden from search engines (noindex).",
    })
  return issues
}
