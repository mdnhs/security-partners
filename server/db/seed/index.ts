import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import { seo } from "@/lib/schemas/common"
import { articleContent } from "@/lib/schemas/content/article"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { serviceContent } from "@/lib/schemas/content/service"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"
import { SETTINGS_KEYS, settingsSchemas } from "@/lib/schemas/settings"
import type { Db } from "@/server/db/client"
import {
  articleCategories,
  articles,
  clients,
  groupCompanies,
  media,
  pages,
  services,
  settings,
  teamMembers,
  users,
} from "@/server/db/schema"
import { backfillMediaUsages } from "@/server/lib/media-usages"
import { PAGE_KEYS, PAGES, templateSchemaFor } from "@/templates/registry"

import { contentFixtures } from "./fixtures"
import { MEDIA, type MediaLookup } from "./fixtures/media"
import { readStaticMedia } from "./media"

export const SEED_TABLES = [
  "media",
  "users",
  "articleCategories",
  "settings",
  "pages",
  "services",
  "articles",
  "teamMembers",
  "clients",
  "groupCompanies",
] as const
export type SeedReport = Record<(typeof SEED_TABLES)[number], number>

/**
 * Idempotent content seed (spec §14 db:seed): inserts every fixture row
 * that is missing, keyed by its natural key, and never overwrites existing
 * rows (admin edits survive a re-run). Versioned rows start published:
 * draft = published, version 1. Returns rows inserted per table.
 */
export async function seedContent(
  db: Db,
  options: { publicDir?: string } = {}
): Promise<SeedReport> {
  const staticMedia = await readStaticMedia(options.publicDir)
  const now = new Date()

  return db.transaction(async (tx) => {
    const insertedMedia = await tx
      .insert(media)
      .values(staticMedia)
      .onConflictDoNothing({ target: [media.driver, media.key] })
      .returning({ id: media.id })
    const mediaRows = await tx
      .select({ id: media.id, key: media.key })
      .from(media)
      .where(
        and(
          eq(media.driver, "static"),
          inArray(
            media.key,
            MEDIA.map((m) => m.key)
          )
        )
      )
    const mediaIdByKey = new Map(mediaRows.map((r) => [r.key, r.id]))
    const lookup: MediaLookup = (key) => {
      const id = mediaIdByKey.get(key)
      if (!id) throw new Error(`Seed: media ${key} is missing`)
      return { mediaId: id }
    }
    const fx = contentFixtures(lookup)

    const insertedUsers = await tx
      .insert(users)
      .values(
        fx.authors.map((a) => ({
          email: a.email,
          name: a.name,
          title: a.title,
          role: "author",
          banned: true,
          banReason: "Byline only: cannot sign in",
        }))
      )
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id })
    const authorRows = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        inArray(
          users.email,
          fx.authors.map((a) => a.email)
        )
      )
    const authorIdByEmail = new Map(authorRows.map((r) => [r.email, r.id]))

    const insertedCategories = await tx
      .insert(articleCategories)
      .values(
        fx.categories.map((c, sortOrder) => ({
          ...categorySchema.parse(c),
          sortOrder,
        }))
      )
      .onConflictDoNothing({ target: articleCategories.slug })
      .returning({ id: articleCategories.id })
    const categoryRows = await tx
      .select({ id: articleCategories.id, slug: articleCategories.slug })
      .from(articleCategories)
    const categoryIdBySlug = new Map(categoryRows.map((r) => [r.slug, r.id]))

    const insertedSettings = await tx
      .insert(settings)
      .values(
        SETTINGS_KEYS.map((key) => {
          const value = settingsSchemas[key].parse(fx.settings[key])
          return { key, draft: value, published: value }
        })
      )
      .onConflictDoNothing({ target: settings.key })
      .returning({ key: settings.key })

    const insertedPages = await tx
      .insert(pages)
      .values(
        PAGE_KEYS.map((key) => {
          const data = templateSchemaFor(key).parse(fx.pages[key].data)
          return {
            key,
            template: PAGES[key],
            seo: seo.parse(fx.pages[key].seo),
            draft: data,
            published: data,
            status: "published" as const,
            publishedAt: now,
          }
        })
      )
      .onConflictDoNothing({ target: pages.key })
      .returning({ id: pages.id })

    const insertedServices = await tx
      .insert(services)
      .values(
        fx.services.map((s, sortOrder) => {
          const content = serviceContent.parse(s.content)
          return {
            slug: s.slug,
            sortOrder,
            seo: seo.parse(s.seo),
            draft: content,
            published: content,
            status: "published" as const,
            publishedAt: now,
          }
        })
      )
      .onConflictDoNothing({ target: services.slug })
      .returning({ id: services.id })

    const insertedArticles = await tx
      .insert(articles)
      .values(
        fx.articles.map((a) => {
          const categoryId = categoryIdBySlug.get(a.categorySlug)
          if (!categoryId)
            throw new Error(`Seed: category ${a.categorySlug} is missing`)
          const content = articleContent.parse(a.content)
          return {
            slug: a.slug,
            categoryId,
            authorId: a.authorEmail
              ? (authorIdByEmail.get(a.authorEmail) ?? null)
              : null,
            readTimeMinutes: a.readTimeMinutes,
            seo: seo.parse(a.seo),
            draft: content,
            published: content,
            status: "published" as const,
            publishedAt: a.publishedAt,
          }
        })
      )
      .onConflictDoNothing({ target: articles.slug })
      .returning({ id: articles.id })

    const insertedTeam = await tx
      .insert(teamMembers)
      .values(
        fx.team.map((member, sortOrder) => {
          const t = teamMemberSchema.parse(member)
          return {
            name: t.name,
            role: t.role,
            bio: t.bio,
            email: t.email,
            photoId: t.photo?.mediaId ?? null,
            sortOrder,
          }
        })
      )
      .onConflictDoNothing({ target: teamMembers.name })
      .returning({ id: teamMembers.id })

    const insertedClients = await tx
      .insert(clients)
      .values(
        fx.clients.map((client, sortOrder) => {
          const c = clientSchema.parse(client)
          return { name: c.name, logoId: c.logo.mediaId, url: c.url, sortOrder }
        })
      )
      .onConflictDoNothing({ target: clients.name })
      .returning({ id: clients.id })

    const insertedGroup = await tx
      .insert(groupCompanies)
      .values(
        fx.groupCompanies.map((company, sortOrder) => {
          const g = groupCompanySchema.parse(company)
          return {
            name: g.name,
            phone: g.phone,
            site: g.site,
            logoId: g.logo.mediaId,
            sortOrder,
          }
        })
      )
      .onConflictDoNothing({ target: groupCompanies.name })
      .returning({ id: groupCompanies.id })

    // Ledger carry: seeded references were never in media_usages. Recomputed
    // from the current rows on every seed, so admin edits are kept.
    await backfillMediaUsages(tx)

    return {
      media: insertedMedia.length,
      users: insertedUsers.length,
      articleCategories: insertedCategories.length,
      settings: insertedSettings.length,
      pages: insertedPages.length,
      services: insertedServices.length,
      articles: insertedArticles.length,
      teamMembers: insertedTeam.length,
      clients: insertedClients.length,
      groupCompanies: insertedGroup.length,
    }
  })
}
