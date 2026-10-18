import { z } from "zod"

import type { Seo } from "@/lib/schemas/common"
import type { SeoIssue } from "@/lib/seo/checks"

export type { SeoIssue }

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
}
