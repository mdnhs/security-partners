import "server-only"

import { type MediaView, replaceMediaRefs } from "@/lib/media"
import { PUBLIC_SETTINGS_KEYS } from "@/lib/schemas/settings"
import type { ArticleRecord } from "@/server/modules/articles/queries"
import { PAGE_KEYS } from "@/templates/registry"
import type { SiteSources } from "@/templates/shared/sources"

import { contentFixtures } from "./index"
import { fixtureMediaKey, fixtureMediaLookup, MEDIA } from "./media"

/** A fixture image served from public/ (no dimensions: the site does not use them). */
function staticMedia(id: string): MediaView {
  const key = fixtureMediaKey(id)
  return {
    id,
    url: key,
    alt: MEDIA.find((m) => m.key === key)?.alt ?? "",
    width: null,
    height: null,
    blurDataUrl: null,
  }
}

/**
 * SiteSources built straight from the seed fixtures, without a database:
 * the expected value for the DB-backed loader (tests/integration) and the
 * interim data source of the public pages until it exists.
 */
export function fixtureSiteSources(): SiteSources {
  const fx = contentFixtures(fixtureMediaLookup)
  const categories = fx.categories.map((c) => ({
    id: `category:${c.slug}`,
    ...c,
  }))
  const authors = new Map(fx.authors.map((a) => [a.email, a]))
  const articles: ArticleRecord[] = fx.articles.map((a) => {
    const category = categories.find((c) => c.slug === a.categorySlug)!
    const author = a.authorEmail ? authors.get(a.authorEmail)! : null
    return {
      id: `article:${a.slug}`,
      slug: a.slug,
      publishedAt: a.publishedAt,
      readTimeMinutes: a.readTimeMinutes,
      seo: a.seo,
      category: { slug: category.slug, name: category.name },
      author: author ? { name: author.name, title: author.title } : null,
      content: a.content,
    }
  })
  const sources = {
    settings: Object.fromEntries(
      PUBLIC_SETTINGS_KEYS.map((key) => [key, fx.settings[key]])
    ),
    pages: Object.fromEntries(
      PAGE_KEYS.map((key) => [
        key,
        { data: fx.pages[key].data, seo: fx.pages[key].seo },
      ])
    ),
    services: fx.services.map((s, sortOrder) => ({
      id: `service:${s.slug}`,
      slug: s.slug,
      sortOrder,
      seo: s.seo,
      content: s.content,
    })),
    articles,
    categories,
    team: fx.team.map((t) => ({ id: `team:${t.name}`, ...t })),
    clients: fx.clients.map((c) => ({ id: `client:${c.name}`, ...c })),
    groupCompanies: fx.groupCompanies.map((g) => ({
      id: `group:${g.name}`,
      ...g,
    })),
  }
  return replaceMediaRefs(sources, staticMedia) as SiteSources
}
