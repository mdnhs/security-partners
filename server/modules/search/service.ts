import "server-only"

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { hasPermission } from "@/lib/auth/permissions"
import {
  type OptionCollection,
  type OptionItem,
  SEARCH_LIMIT_PER_TYPE,
  type SearchResult,
} from "@/lib/schemas/api/search"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden } from "@/server/lib/errors"
import { PAGE_KEYS, PAGE_PATHS } from "@/templates/registry"

import * as repo from "./repo"

const LIMIT = SEARCH_LIMIT_PER_TYPE

/** ⌘K search across the records whose screens the actor may read. */
export async function search(
  actor: Actor,
  q: string
): Promise<{ items: SearchResult[] }> {
  const db = getDb()
  const can = (req: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.roles, req)
  const needle = q.toLowerCase()
  const items: SearchResult[] = []

  if (can({ page: ["read"] }))
    items.push(
      ...PAGE_KEYS.filter((key) =>
        [key, PAGE_LABELS[key], PAGE_PATHS[key]].some((v) =>
          v.toLowerCase().includes(needle)
        )
      )
        .slice(0, LIMIT)
        .map((key) => ({
          type: "page" as const,
          id: key,
          title: PAGE_LABELS[key],
          subtitle: PAGE_PATHS[key],
          href: `/admin/pages/${key}`,
        }))
    )

  if (can({ service: ["read"] }))
    for (const row of await repo.searchServices(db, q, LIMIT))
      items.push({
        type: "service",
        id: row.id,
        title: row.title,
        subtitle: `/services/${row.slug}`,
        href: `/admin/services/${row.id}`,
      })

  // Every article reader may find every article; the editor then applies
  // that reader's rights (others' articles open read-only for authors).
  if (can({ article: ["read"] }))
    for (const row of await repo.searchArticles(db, q, LIMIT))
      items.push({
        type: "article",
        id: row.id,
        title: row.title,
        subtitle: `/blog/${row.slug}`,
        href: `/admin/articles/${row.id}`,
      })

  if (can({ collection: ["read"] })) {
    const [team, clientRows, companies, categories] = await Promise.all([
      repo.searchTeam(db, q, LIMIT),
      repo.searchClients(db, q, LIMIT),
      repo.searchGroupCompanies(db, q, LIMIT),
      repo.searchCategories(db, q, LIMIT),
    ])
    for (const row of team)
      items.push({
        type: "team",
        id: row.id,
        title: row.name,
        subtitle: row.role,
        href: `/admin/team?edit=${row.id}`,
      })
    for (const row of clientRows)
      items.push({
        type: "client",
        id: row.id,
        title: row.name,
        subtitle: null,
        href: `/admin/clients?edit=${row.id}`,
      })
    for (const row of companies)
      items.push({
        type: "groupCompany",
        id: row.id,
        title: row.name,
        subtitle: row.site,
        href: `/admin/group-companies?edit=${row.id}`,
      })
    for (const row of categories)
      items.push({
        type: "category",
        id: row.id,
        title: row.name,
        subtitle: row.slug,
        href: `/admin/categories?edit=${row.id}`,
      })
  }

  if (can({ lead: ["read"] }))
    for (const row of await repo.searchLeads(db, q, LIMIT))
      items.push({
        type: "lead",
        id: row.id,
        title: row.name,
        subtitle: row.email,
        href: `/admin/leads/${row.id}`,
      })

  return { items }
}

/**
 * Values for SchemaForm pickers. `links` merges every internal destination
 * the actor may read (pages, services, articles) as URL paths.
 */
export async function options(
  actor: Actor,
  collection: OptionCollection
): Promise<{ items: OptionItem[] }> {
  const db = getDb()
  const can = (req: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.roles, req)

  const pages = (): OptionItem[] =>
    PAGE_KEYS.map((key) => ({
      value: PAGE_PATHS[key],
      label: PAGE_LABELS[key],
      group: "Pages",
    }))
  const serviceItems = async (byPath: boolean): Promise<OptionItem[]> =>
    (await repo.serviceOptionRows(db)).map((row) => ({
      value: byPath ? `/services/${row.slug}` : row.slug,
      label: row.title,
      group: "Services",
    }))
  const articleItems = async (byPath: boolean): Promise<OptionItem[]> =>
    (await repo.articleOptionRows(db)).map((row) => ({
      value: byPath ? `/blog/${row.slug}` : row.slug,
      label: row.title,
      group: "Articles",
    }))

  switch (collection) {
    case "pages":
      if (!can({ page: ["read"] })) throw forbidden()
      return { items: pages() }
    case "services":
      if (!can({ service: ["read"] })) throw forbidden()
      return { items: await serviceItems(false) }
    case "articles":
      if (!can({ article: ["read"] })) throw forbidden()
      return { items: await articleItems(false) }
    case "categories":
      if (!can({ collection: ["read"] })) throw forbidden()
      return {
        items: (await repo.categoryOptionRows(db)).map((row) => ({
          value: row.id,
          label: row.name,
          group: "Categories",
        })),
      }
    case "links": {
      const items: OptionItem[] = []
      if (can({ page: ["read"] })) items.push(...pages())
      if (can({ service: ["read"] })) items.push(...(await serviceItems(true)))
      if (can({ article: ["read"] })) items.push(...(await articleItems(true)))
      return { items }
    }
  }
}
