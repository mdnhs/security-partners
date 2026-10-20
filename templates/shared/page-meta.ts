import type { Metadata } from "next"

import { interpolate } from "@/lib/interpolate"
import type { MediaView } from "@/lib/media"
import { builderPath } from "@/lib/schemas/api/builder-pages"
import { effectiveSeo, filled } from "@/lib/seo/effective"
import { OG_IMAGE_SIZE, type OgKind, ogImagePath } from "@/lib/seo/urls"
import { PAGE_PATHS, type PageKey } from "@/templates/registry"

import type { SiteSources } from "./sources"
import { placeholders } from "./views"

// <head> metadata per public URL (spec §10): title/description with
// fallbacks to seo.defaults (lib/seo/effective.ts), canonical, robots,
// Open Graph and Twitter cards. Relative URLs resolve against the
// metadataBase set by app/(site)/layout.tsx (siteMetadata).

type SiteSeo = SiteSources["pages"]["home"]["seo"]

type Subject = {
  kind: OgKind
  /** Page key, slug or builder page id: the generated card's address (/og/<kind>/<id>). */
  id: string
  path: string
  seo: SiteSeo
  /** Record name for "{title} | …"; null = the site title (home). */
  name: string | null
  fallbackDescription: string | null
  article?: {
    publishedTime: string | null
    section: string
    tags: string[]
    author: string | null
  }
}

type ShareImage = {
  url: string
  width?: number
  height?: number
  alt?: string
}

/** The record's own image, else the site default, else the generated card. */
function shareImage(s: SiteSources, subject: Subject): ShareImage {
  const media: MediaView | null =
    subject.seo.ogImage ?? s.settings["seo.defaults"].ogImage
  if (media)
    return {
      url: media.url,
      ...(media.width && media.height
        ? { width: media.width, height: media.height }
        : {}),
      ...(media.alt ? { alt: media.alt } : {}),
    }
  return { url: ogImagePath(subject.kind, subject.id), ...OG_IMAGE_SIZE }
}

function metadataFor(s: SiteSources, subject: Subject): Metadata {
  const { title, description } = effectiveSeo({
    seo: subject.seo,
    defaults: s.settings["seo.defaults"],
    name: subject.name,
    fallbackDescription: subject.fallbackDescription,
    values: placeholders(s),
  })
  const image = shareImage(s, subject)
  // Social overrides (Open Graph/Twitter only); the page title and meta
  // description stay as above. {placeholders} fill like the own fields.
  const social = (value: string | undefined) => {
    const own = filled(value)
    return own === null ? null : interpolate(own, placeholders(s))
  }
  const socialDescription = social(subject.seo.ogDescription) ?? description
  const shared = {
    url: subject.path,
    siteName: s.settings.site.name,
    title: social(subject.seo.ogTitle) ?? title,
    description: socialDescription,
    images: [image],
  }
  const { article } = subject
  return {
    title,
    description,
    alternates: { canonical: filled(subject.seo.canonical) ?? subject.path },
    ...(subject.seo.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: article
      ? {
          ...shared,
          type: "article",
          ...(article.publishedTime
            ? { publishedTime: article.publishedTime }
            : {}),
          section: article.section,
          ...(article.tags.length > 0 ? { tags: article.tags } : {}),
          ...(article.author ? { authors: [article.author] } : {}),
        }
      : { ...shared, type: "website" },
    twitter: {
      card: subject.seo.twitterCard ?? "summary_large_image",
      // The social title, like og:title (X does not fall back once set).
      title: shared.title,
      description: socialDescription,
      images: [{ url: image.url, ...(image.alt ? { alt: image.alt } : {}) }],
    },
  }
}

export function pageMetadata(s: SiteSources, key: PageKey): Metadata {
  const page = s.pages[key]
  return metadataFor(s, {
    kind: "page",
    id: key,
    path: PAGE_PATHS[key],
    seo: page.seo,
    name:
      key === "home"
        ? null
        : (page.data as { hero: { title: string } }).hero.title,
    fallbackDescription: null,
  })
}

export function serviceMetadata(s: SiteSources, slug: string): Metadata {
  const service = s.services.find((x) => x.slug === slug)
  if (!service) return {}
  return metadataFor(s, {
    kind: "service",
    id: slug,
    path: `/services/${slug}`,
    seo: service.seo,
    name: service.content.title,
    fallbackDescription: service.content.detail.intro,
  })
}

export function articleMetadata(s: SiteSources, slug: string): Metadata {
  const article = s.articles.find((a) => a.slug === slug)
  if (!article) return {}
  return metadataFor(s, {
    kind: "article",
    id: slug,
    path: `/blog/${slug}`,
    seo: article.seo,
    name: article.content.title,
    fallbackDescription: article.content.excerpt,
    article: {
      publishedTime: article.publishedAt?.toISOString() ?? null,
      section: article.category.name,
      tags: article.content.tags,
      author: article.author?.name ?? null,
    },
  })
}

/**
 * A builder page at /p/<slug>: its SEO fields, else the page title in the
 * title template and the first hero's description. The generated card is
 * addressed by id (/og/builder/<id>), so it survives slug changes.
 */
export function builderPageMetadata(
  s: SiteSources,
  page: {
    id: string
    slug: string
    title: string
    seo: SiteSeo
    firstHeroDescription: string | null
  }
): Metadata {
  return metadataFor(s, {
    kind: "builder",
    id: page.id,
    path: builderPath(page.slug),
    seo: page.seo,
    name: page.title,
    fallbackDescription: page.firstHeroDescription,
  })
}

/** Bundled icon (public/favicon.ico): used until settings.site.favicon is set. */
export const DEFAULT_FAVICON = "/favicon.ico"

/**
 * Root-layout metadata: metadataBase (canonical, og:url and share images
 * become absolute on the production origin) and the default description,
 * which the 404 page (no metadata of its own) inherits. The browser tab
 * icon is settings.site.favicon, else the bundled public/favicon.ico.
 * Site-wide noindex adds a root robots tag (pages inherit it); search
 * console tokens are emitted only when set (seeded: neither key).
 */
export function siteMetadata(s: SiteSources, origin: string): Metadata {
  const defaults = s.settings["seo.defaults"]
  // The layout reads settings unparsed: a row from before the robots
  // migration has no verification and must still yield the base metadata.
  const verification = siteVerification(
    defaults.verification ?? { google: "", bing: "" }
  )
  return {
    metadataBase: new URL(origin),
    description: interpolate(defaults.description, placeholders(s)),
    icons: { icon: s.settings.site.favicon?.url ?? DEFAULT_FAVICON },
    ...(defaults.robots === "noindex"
      ? { robots: { index: false, follow: false } }
      : {}),
    ...(verification ? { verification } : {}),
  }
}

/** google-site-verification and Bing's msvalidate.01; null when both are empty. */
function siteVerification({
  google,
  bing,
}: {
  google: string
  bing: string
}): Metadata["verification"] | null {
  if (!google && !bing) return null
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  }
}
