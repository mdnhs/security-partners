import { z } from "zod"

import type { Seo } from "@/lib/schemas/common"
import type { CheckResult, SeoCheckId } from "@/lib/seo/checks"

/** A failed check of one record (SEO overview entries). */
export type SeoIssue = { check: SeoCheckId; message: string }

export const SEO_KINDS = ["page", "service", "article"] as const
export type SeoKind = (typeof SEO_KINDS)[number]

/** Page id = page key; service/article id = row id (uuid). */
export const seoEntryParam = z.object({
  kind: z.enum(SEO_KINDS),
  id: z.string().min(1).max(100),
})

/** PUT /seo/entries/:kind/:id — `seo` is validated by the service (field paths without "seo."). */
export const seoUpdateInput = z.object({ seo: z.unknown() })

export type SeoEntry = {
  kind: SeoKind
  id: string
  /** Admin name: page label, service or article title. */
  name: string
  path: string
  published: boolean
  seo: Seo
  /** What the live page renders (lib/seo/effective.ts). */
  title: string
  description: string
  /** What it would render without its own title/description (form previews). */
  fallback: { title: string; description: string }
  image: "own" | "default" | "generated"
  /** Checks of published records only. */
  issues: SeoIssue[]
}

export type SeoOverviewDto = {
  entries: SeoEntry[]
  checks: { passed: number; total: number }
  /**
   * SEO › Defaults the previews need: the "{title} | …" pattern, the site
   * share image (media id) and whether the site robots mode is noindex
   * (the live checklist). Always sent; optional for older fixtures.
   */
  defaults?: {
    titleTemplate: string
    ogImageId: string | null
    siteNoindex?: boolean
  }
}

/** One failed check with where to fix it (spec §7.1 fixHref). */
export type SeoIssueDto = {
  kind: "page" | "service" | "article" | "builder" | "media"
  /** Page key, row id or media id. */
  id: string
  title: string
  /** Public path; null for media. */
  path: string | null
  check: SeoCheckId
  message: string
  fixHref: string
}

/** GET /seo/health: score over the published records' checks, issues, alt-text coverage. */
export type SeoHealthDto = {
  /** round(passed / total * 100); 100 when nothing is published. */
  score: number
  passed: number
  total: number
  entities: {
    kind: SeoIssueDto["kind"]
    id: string
    title: string
    path: string | null
    published: boolean
    results: CheckResult[]
  }[]
  /** Published records' failures, then images missing alt text (once each). */
  issues: SeoIssueDto[]
  alt: {
    images: number
    described: number
    decorative: number
    missing: number
  }
}
