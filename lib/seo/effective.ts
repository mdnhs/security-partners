import { interpolate, type Placeholders } from "@/lib/interpolate"
import type { Seo } from "@/lib/schemas/common"
import type { SeoDefaultsSettings } from "@/lib/schemas/settings/seo-defaults"

// What a public page renders as <title> and meta description: its own seo
// fields, else the record's fallbacks, else SEO › Defaults. Mirrors
// templates/shared/page-meta.ts (the admin SEO overview and the public
// metadata must agree).

export type EffectiveSeo = {
  title: string
  description: string
  /** No own description and no record fallback: the site-wide default is used. */
  usesDefaultDescription: boolean
}

export function effectiveSeo(input: {
  defaults: Pick<SeoDefaultsSettings, "title" | "titleTemplate" | "description">
  /** Record name for the title template; null = the site title (home). */
  name: string | null
  /** Record text used when there is no own description (service intro, article excerpt). */
  fallbackDescription: string | null
  /** Settings › Contact {placeholders}. */
  values: Placeholders
  seo: Seo
}): EffectiveSeo {
  const { defaults, seo } = input
  const title =
    seo.title ??
    (input.name === null
      ? defaults.title
      : interpolate(defaults.titleTemplate, { title: input.name }))
  const description =
    seo.description ?? input.fallbackDescription ?? defaults.description
  return {
    title: interpolate(title, input.values),
    description: interpolate(description, input.values),
    usesDefaultDescription:
      seo.description === undefined && input.fallbackDescription === null,
  }
}
