import "server-only"

import { asc, ilike, or, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  articleCategories,
  articles,
  clients,
  groupCompanies,
  services,
  teamMembers,
} from "@/server/db/schema"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)
const contains = (q: string) => `%${escapeLike(q)}%`

const serviceTitle = sql<string>`${services.draft}->>'title'`
const articleTitle = sql<string>`${articles.draft}->>'title'`

export function searchServices(db: DbOrTx, q: string, limit: number) {
  return db
    .select({ id: services.id, slug: services.slug, title: serviceTitle })
    .from(services)
    .where(
      or(ilike(serviceTitle, contains(q)), ilike(services.slug, contains(q)))
    )
    .orderBy(asc(services.sortOrder))
    .limit(limit)
}

export function searchTeam(db: DbOrTx, q: string, limit: number) {
  return db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .where(
      or(
        ilike(teamMembers.name, contains(q)),
        ilike(teamMembers.role, contains(q))
      )
    )
    .orderBy(asc(teamMembers.sortOrder))
    .limit(limit)
}

export function searchClients(db: DbOrTx, q: string, limit: number) {
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(ilike(clients.name, contains(q)))
    .orderBy(asc(clients.sortOrder))
    .limit(limit)
}

export function searchGroupCompanies(db: DbOrTx, q: string, limit: number) {
  return db
    .select({
      id: groupCompanies.id,
      name: groupCompanies.name,
      site: groupCompanies.site,
    })
    .from(groupCompanies)
    .where(
      or(
        ilike(groupCompanies.name, contains(q)),
        ilike(groupCompanies.site, contains(q))
      )
    )
    .orderBy(asc(groupCompanies.sortOrder))
    .limit(limit)
}

export function searchCategories(db: DbOrTx, q: string, limit: number) {
  return db
    .select({
      id: articleCategories.id,
      name: articleCategories.name,
      slug: articleCategories.slug,
    })
    .from(articleCategories)
    .where(
      or(
        ilike(articleCategories.name, contains(q)),
        ilike(articleCategories.slug, contains(q))
      )
    )
    .orderBy(asc(articleCategories.sortOrder))
    .limit(limit)
}

/** Every service (slug + draft title) in display order (option lists). */
export function serviceOptionRows(db: DbOrTx) {
  return db
    .select({ slug: services.slug, title: serviceTitle })
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.slug))
}

/** Every article (slug + draft title), newest first (option lists). */
export function articleOptionRows(db: DbOrTx) {
  return db
    .select({ slug: articles.slug, title: articleTitle })
    .from(articles)
    .orderBy(sql`${articles.publishedAt} desc nulls first`, asc(articles.slug))
}

export function categoryOptionRows(db: DbOrTx) {
  return db
    .select({ id: articleCategories.id, name: articleCategories.name })
    .from(articleCategories)
    .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.name))
}
