import "server-only"

import { uuidv7 } from "uuidv7"
import type { z } from "zod"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import {
  type CategoryItem,
  type CollectionInput,
  type CollectionItem,
  type CollectionListQuery,
  type CollectionName,
  collectionSchemas,
} from "@/lib/schemas/api/collections"
import type { Paginated } from "@/lib/schemas/api/list"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { clearMediaUsages, syncMediaUsages } from "@/server/lib/media-usages"
import {
  FOREIGN_KEY_VIOLATION,
  pgConstraint,
  pgErrorCode,
  UNIQUE_VIOLATION,
} from "@/server/lib/pg-errors"
import { snapshotRevision, validateContent } from "@/server/lib/versioning"

import {
  articleCountsByCategory,
  type CollectionInsert,
  type CollectionRow,
  countArticlesInCategory,
  deleteCollectionRow,
  findCollectionRow,
  insertCollectionRow,
  listCollectionPage,
  nextCollectionSortOrder,
  updateCollectionRow,
} from "./repo"

/** Per-collection wiring: revision/audit entity, cache tag, row ⇄ record mapping. */
const CONFIG = {
  team: {
    entityType: "team",
    label: "Team member",
    unique: {
      field: "name",
      message: "Someone with this name is already on the team",
    },
    tag: tag.team,
    toRow: (v: CollectionInput<"team">): Partial<CollectionInsert<"team">> => ({
      name: v.name,
      role: v.role,
      bio: v.bio,
      email: v.email,
      photoId: v.photo?.mediaId ?? null,
    }),
    fromRow: (r: CollectionRow<"team">): CollectionInput<"team"> => ({
      name: r.name,
      role: r.role,
      bio: r.bio,
      email: r.email,
      photo: r.photoId ? { mediaId: r.photoId } : null,
    }),
  },
  clients: {
    entityType: "client",
    label: "Client",
    unique: { field: "name", message: "This client is already listed" },
    tag: tag.clients,
    toRow: (
      v: CollectionInput<"clients">
    ): Partial<CollectionInsert<"clients">> => ({
      name: v.name,
      logoId: v.logo.mediaId,
      url: v.url,
    }),
    fromRow: (r: CollectionRow<"clients">): CollectionInput<"clients"> => ({
      name: r.name,
      logo: { mediaId: r.logoId },
      url: r.url,
    }),
  },
  "group-companies": {
    entityType: "groupCompany",
    label: "Group company",
    unique: { field: "name", message: "This company is already listed" },
    tag: tag.groupCompanies,
    toRow: (
      v: CollectionInput<"group-companies">
    ): Partial<CollectionInsert<"group-companies">> => ({
      name: v.name,
      phone: v.phone,
      site: v.site,
      logoId: v.logo.mediaId,
    }),
    fromRow: (
      r: CollectionRow<"group-companies">
    ): CollectionInput<"group-companies"> => ({
      name: r.name,
      phone: r.phone,
      site: r.site,
      logo: { mediaId: r.logoId },
    }),
  },
  categories: {
    entityType: "category",
    label: "Category",
    unique: {
      field: "slug",
      message: "Another category already uses this address",
    },
    tag: tag.categories,
    toRow: (
      v: CollectionInput<"categories">
    ): Partial<CollectionInsert<"categories">> => ({
      slug: v.slug,
      name: v.name,
      showInFilter: v.showInFilter,
    }),
    fromRow: (
      r: CollectionRow<"categories">
    ): CollectionInput<"categories"> => ({
      slug: r.slug,
      name: r.name,
      showInFilter: r.showInFilter,
    }),
  },
} as const

type Config<C extends CollectionName> = {
  entityType: string
  label: string
  unique: { field: string; message: string }
  tag: string
  toRow: (v: CollectionInput<C>) => Partial<CollectionInsert<C>>
  fromRow: (r: CollectionRow<C>) => CollectionInput<C>
}
const configOf = <C extends CollectionName>(name: C) =>
  CONFIG[name] as unknown as Config<C>

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toItem<C extends CollectionName>(
  name: C,
  row: CollectionRow<C>
): CollectionItem<C> {
  return {
    ...configOf(name).fromRow(row),
    id: row.id,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function duplicate(name: CollectionName) {
  const { unique } = CONFIG[name]
  return new AppError("CONFLICT", unique.message, {
    fieldErrors: { [unique.field]: [unique.message] },
  })
}

export async function listCollection<C extends CollectionName>(
  actor: Actor,
  name: C,
  query: CollectionListQuery
): Promise<Paginated<CollectionItem<C> | CategoryItem>> {
  assertCan(actor, { collection: ["read"] })
  const db = getDb()
  const { rows, total } = await listCollectionPage(db, name, {
    q: query.q || undefined,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  const counts =
    name === "categories" ? await articleCountsByCategory(db) : null
  return {
    items: rows.map((row) => {
      const item = toItem(name, row)
      return counts
        ? {
            ...(item as CollectionItem<"categories">),
            articleCount: counts.get(row.id) ?? 0,
          }
        : item
    }),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getCollectionItem<C extends CollectionName>(
  actor: Actor,
  name: C,
  id: string
) {
  assertCan(actor, { collection: ["read"] })
  const row = await findCollectionRow(getDb(), name, id)
  if (!row) throw notFound(CONFIG[name].label)
  return toItem(name, row)
}

/** Concurrent saves of one record race for the same revision number. */
const REVISION_UNIQUE = "revisions_entity_version_unique"

/** 23505 → 409: a lost revision race (retry) or the collection's unique field. */
function uniqueViolation(name: CollectionName, err: unknown): AppError {
  if (pgConstraint(err) === REVISION_UNIQUE)
    return new AppError(
      "CONFLICT",
      "This record was changed by someone else at the same time. Reload and try again."
    )
  return duplicate(name)
}

const categoryInUse = (n?: number) =>
  new AppError(
    "CONFLICT",
    n === undefined
      ? "This category has articles. Move them to another category first."
      : `This category has ${n} article${n === 1 ? "" : "s"}. Move them to another category first.`,
    n === undefined ? undefined : { current: { articleCount: n } }
  )

/**
 * Create/update/delete publish immediately (spec §5.3): each change writes
 * a revision (version = max + 1), keeps media_usages exact, is audited and
 * expires the collection's cache tag. Usages are written before the row so
 * a missing image is a 422 on its field (not an FK error on the row), and
 * the usage rows then hold the media against deletion (RESTRICT).
 */
export async function createCollectionItem<C extends CollectionName>(
  actor: Actor,
  name: C,
  input: unknown
) {
  assertCan(actor, { collection: ["create"] })
  const config = configOf(name)
  const value = validateContent(
    collectionSchemas[name] as unknown as z.ZodType<CollectionInput<C>>,
    input
  )
  try {
    const row = await getDb().transaction(async (tx) => {
      const id = uuidv7()
      await syncMediaUsages(tx, config.entityType, id, value)
      const created = await insertCollectionRow(tx, name, {
        ...config.toRow(value),
        id,
        sortOrder: await nextCollectionSortOrder(tx, name),
      } as CollectionInsert<C>)
      await snapshotRevision(tx, actor, config.entityType, id, value)
      await writeAudit(tx, actor, {
        action: `${config.entityType}.created`,
        entityType: config.entityType,
        entityId: id,
      })
      return created
    })
    invalidate(config.tag)
    return toItem(name, row)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw uniqueViolation(name, err)
    throw err
  }
}

export async function updateCollectionItem<C extends CollectionName>(
  actor: Actor,
  name: C,
  id: string,
  input: unknown
) {
  assertCan(actor, { collection: ["update"] })
  const config = configOf(name)
  const value = validateContent(
    collectionSchemas[name] as unknown as z.ZodType<CollectionInput<C>>,
    input
  )
  try {
    const row = await getDb().transaction(async (tx) => {
      if (!(await findCollectionRow(tx, name, id))) throw notFound(config.label)
      await syncMediaUsages(tx, config.entityType, id, value)
      const updated = await updateCollectionRow(
        tx,
        name,
        id,
        config.toRow(value)
      )
      if (!updated) throw notFound(config.label)
      await snapshotRevision(tx, actor, config.entityType, id, value)
      await writeAudit(tx, actor, {
        action: `${config.entityType}.updated`,
        entityType: config.entityType,
        entityId: id,
      })
      return updated
    })
    invalidate(config.tag)
    return toItem(name, row)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw uniqueViolation(name, err)
    throw err
  }
}

export async function deleteCollectionItem(
  actor: Actor,
  name: CollectionName,
  id: string
) {
  assertCan(actor, { collection: ["delete"] })
  const config = configOf(name)
  try {
    await getDb().transaction(async (tx) => {
      const existing = await findCollectionRow(tx, name, id)
      if (!existing) throw notFound(config.label)
      if (name === "categories") {
        const n = await countArticlesInCategory(tx, id)
        if (n > 0) throw categoryInUse(n)
      }
      await clearMediaUsages(tx, config.entityType, id)
      await deleteCollectionRow(tx, name, id)
      await writeAudit(tx, actor, {
        action: `${config.entityType}.deleted`,
        entityType: config.entityType,
        entityId: id,
        diff: config.fromRow(existing as CollectionRow<typeof name>),
      })
    })
  } catch (err) {
    // An article filed under the category after the count (FK RESTRICT).
    if (name === "categories" && pgErrorCode(err) === FOREIGN_KEY_VIOLATION)
      throw categoryInUse()
    throw err
  }
  invalidate(config.tag)
  return { ok: true as const }
}
