import { interpolate, type Placeholders } from "@/lib/interpolate"

/** A stored SEO string, or null when blank (a cleared field means "use the fallback"). */
export function filled(value: string | null | undefined): string | null {
  return value && value.trim() !== "" ? value : null
}

export type EffectiveSeoInput = {
  seo: { title?: string; description?: string }
  defaults: { title: string; titleTemplate: string; description: string }
  /** The record's name for "{title} | …"; null = the site title (home). */
  name: string | null
  /** Record-specific description (service intro, article excerpt). */
  fallbackDescription: string | null
  /** Settings › Contact placeholders ({phone24h} …). */
  values: Placeholders
}

export type EffectiveSeo = {
  title: string
  description: string
  /** True when the site-wide default description is used (SEO check). */
  usesDefaultDescription: boolean
}

/**
 * The <title> and description a public URL renders (spec §10): the
 * record's SEO fields, else its own fallbacks, else seo.defaults. Shared by
 * generateMetadata (templates/shared/page-meta.ts) and the admin SEO
 * overview (server/modules/seo/service.ts), so both always agree.
 */
export function effectiveSeo(input: EffectiveSeoInput): EffectiveSeo {
  const title =
    filled(input.seo.title) ??
    (input.name === null
      ? input.defaults.title
      : interpolate(input.defaults.titleTemplate, { title: input.name }))
  const own = filled(input.seo.description) ?? filled(input.fallbackDescription)
  return {
    title: interpolate(title, input.values),
    description: interpolate(own ?? input.defaults.description, input.values),
    usesDefaultDescription: own === null,
  }
}
