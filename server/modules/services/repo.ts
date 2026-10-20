import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  max,
  or,
  sql,
} from "drizzle-orm"

import type { Sort } from "@/lib/schemas/api/list"
import type { ServiceContent } from "@/lib/schemas/content/service"
import type { DbOrTx } from "@/server/db/client"
import { containsPattern } from "@/server/db/like"
import { services, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

export function listServiceRows(db: DbOrTx) {
  return db
    .select()
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.slug))
}

export async function findServiceBySlug(db: DbOrTx, slug: string) {
  const [row] = await db.select().from(services).where(eq(services.slug, slug))
  return row ?? null
}

export async function findServiceById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(services).where(eq(services.id, id))
  return row ?? null
}

const withEditor = { ...getTableColumns(services), updatedByName: users.name }
const title = sql<string>`${services.draft}->>'title'`

export async function findServiceForEdit(db: DbOrTx, id: string) {
  const [row] = await db
    .select(withEditor)
    .from(services)
    .leftJoin(users, eq(users.id, services.updatedBy))
    .where(eq(services.id, id))
  return row ?? null
}
export type ServiceEditRow = NonNullable<
  Awaited<ReturnType<typeof findServiceForEdit>>
>

/** Admin list: search title/slug, sort, paginate. */
export async function listServicesForAdmin(
  db: DbOrTx,
  opts: {
    q?: string
    sort: Sort<"sortOrder" | "title" | "updatedAt">
    page: number
    pageSize: number
  }
) {
  const pattern = opts.q ? containsPattern(opts.q) : null
  const where = pattern
    ? or(ilike(title, pattern), ilike(services.slug, pattern))
    : undefined
  const [{ total }] = await db
    .select({ total: count() })
    .from(services)
    .where(where)
  const column =
    opts.sort.field === "title"
      ? title
      : opts.sort.field === "updatedAt"
        ? services.updatedAt
        : services.sortOrder
  const rows = await db
    .select(withEditor)
    .from(services)
    .leftJoin(users, eq(users.id, services.updatedBy))
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(services.slug)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

export async function nextServiceSortOrder(db: DbOrTx): Promise<number> {
  const [row] = await db.select({ top: max(services.sortOrder) }).from(services)
  return (row?.top ?? -1) + 1
}

export async function insertService(
  db: DbOrTx,
  values: {
    slug: string
    draft: ServiceContent
    sortOrder: number
    updatedBy: string
  }
): Promise<string> {
  const [row] = await db
    .insert(services)
    .values(values)
    .returning({ id: services.id })
  return row.id
}

export async function updateServiceIfVersion(
  db: DbOrTx,
  id: string,
  version: number,
  patch: VersionedPatch<unknown> & { slug?: string }
): Promise<ServiceEditRow | null> {
  const [updated] = await db
    .update(services)
    .set({
      ...patch,
      draft: patch.draft as ServiceContent | undefined,
      published: patch.published as ServiceContent | null | undefined,
      version: version + 1,
    })
    .where(and(eq(services.id, id), eq(services.version, version)))
    .returning({ id: services.id })
  return updated ? findServiceForEdit(db, id) : null
}

/** Deletes only when `version` is current; false when stale or gone. */
export async function deleteServiceIfVersion(
  db: DbOrTx,
  id: string,
  version: number
): Promise<boolean> {
  const rows = await db
    .delete(services)
    .where(and(eq(services.id, id), eq(services.version, version)))
    .returning({ id: services.id })
  return rows.length > 0
}
