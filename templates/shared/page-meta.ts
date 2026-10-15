import type { Metadata } from "next"

import { interpolate } from "@/lib/interpolate"
import type { PageKey } from "@/templates/registry"

import type { SiteSources } from "./sources"
import { placeholders } from "./views"

// <title> and description per public URL. Page rows carry explicit seo
// (seeded from the static site); otherwise "{title} | Security Partners
// Ltd." and the default description apply. Phase 8 adds canonical, OG and
// JSON-LD on top.

function described(
  s: SiteSources,
  title: string,
  description: string | undefined
): Metadata {
  const values = placeholders(s)
  return {
    title: interpolate(title, values),
    description: interpolate(
      description ?? s.settings["seo.defaults"].description,
      values
    ),
  }
}

export function pageMetadata(s: SiteSources, key: PageKey): Metadata {
  const defaults = s.settings["seo.defaults"]
  if (key === "home") {
    const { seo } = s.pages.home
    return described(s, seo.title ?? defaults.title, seo.description)
  }
  const page = s.pages[key]
  const title =
    page.seo.title ??
    interpolate(defaults.titleTemplate, { title: page.data.hero.title })
  return described(s, title, page.seo.description)
}

export function serviceMetadata(s: SiteSources, slug: string): Metadata {
  const service = s.services.find((x) => x.slug === slug)
  if (!service) return {}
  const title =
    service.seo.title ??
    interpolate(s.settings["seo.defaults"].titleTemplate, {
      title: service.content.title,
    })
  return described(
    s,
    title,
    service.seo.description ?? service.content.detail.intro
  )
}

export function articleMetadata(s: SiteSources, slug: string): Metadata {
  const article = s.articles.find((a) => a.slug === slug)
  if (!article) return {}
  const title =
    article.seo.title ??
    interpolate(s.settings["seo.defaults"].titleTemplate, {
      title: article.content.title,
    })
  return described(s, title, article.seo.description ?? article.content.excerpt)
}
