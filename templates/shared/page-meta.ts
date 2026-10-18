import type { Metadata } from "next"

import { interpolate } from "@/lib/interpolate"
import type { MediaView } from "@/lib/media"
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
  /** Page key or slug: the generated card's address (/og/<kind>/<id>). */
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
  const shared = {
    url: subject.path,
    siteName: s.settings.site.name,
    title,
    description,
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
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
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
 * Root-layout metadata: metadataBase (canonical, og:url and share images
 * become absolute on the production origin) and the default description,
 * which the 404 page (no metadata of its own) inherits.
 */
export function siteMetadata(s: SiteSources, origin: string): Metadata {
  return {
    metadataBase: new URL(origin),
    description: interpolate(
      s.settings["seo.defaults"].description,
      placeholders(s)
    ),
  }
}
