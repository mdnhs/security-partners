import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Paginated } from "@/lib/schemas/api/list"
import type {
  ServiceDto,
  ServiceListItem,
  ServiceListQuery,
} from "@/lib/schemas/api/services"
import { serviceContent } from "@/lib/schemas/content/service"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, conflict, forbidden, notFound } from "@/server/lib/errors"
import { clearMediaUsages, syncMediaUsages } from "@/server/lib/media-usages"
import { pgErrorCode, UNIQUE_VIOLATION } from "@/server/lib/pg-errors"
import {
  publish,
  restoreRevision,
  saveDraft,
  validateContent,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"
import { recordMove } from "@/server/modules/redirects/service"

import {
  deleteServiceIfVersion,
  findServiceForEdit,
  insertService,
  listServicesForAdmin,
  nextServiceSortOrder,
  type ServiceEditRow,
  updateServiceIfVersion,
} from "./repo"

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toDto(row: ServiceEditRow): ServiceDto {
  return {
    id: row.id,
    slug: row.slug,
    sortOrder: row.sortOrder,
    title: row.draft.title,
    ...versionedDto<unknown>(row),
  }
}

const slugTaken = () =>
  new AppError("CONFLICT", "Another service already uses this address", {
    fieldErrors: { slug: ["Already used by another service"] },
  })

/** Versioning adapter for services (id = row id; tags = list + detail). */
export const serviceStore: VersionedStore<unknown, ServiceEditRow> = {
  entityType: "service",
  label: "Service",
  schema: () => serviceContent,
  find: (db, id) => findServiceForEdit(db, id),
  update: (db, id, version, patch) =>
    updateServiceIfVersion(db, id, version, patch),
  tags: (row) => [tag.services, tag.service(row.slug)],
  present: (row) => toDto(row),
}

export async function listServicesAdmin(
  actor: Actor,
  query: ServiceListQuery
): Promise<Paginated<ServiceListItem>> {
  assertCan(actor, { service: ["read"] })
  const { rows, total } = await listServicesForAdmin(getDb(), {
    q: query.q || undefined,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map((row) => {
      const dto: Partial<ServiceDto> = toDto(row)
      delete dto.draft
      delete dto.published
      return dto as ServiceListItem
    }),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getServiceAdmin(
  actor: Actor,
  id: string
): Promise<ServiceDto> {
  assertCan(actor, { service: ["read"] })
  const row = await findServiceForEdit(getDb(), id)
  if (!row) throw notFound("Service")
  return toDto(row)
}

/** New services start as an unpublished draft at the end of the list. */
export async function createService(
  actor: Actor,
  input: { slug: string; draft: unknown }
): Promise<ServiceDto> {
  assertCan(actor, { service: ["create"] })
  const draft = validateContent(serviceContent, input.draft)
  const db = getDb()
  try {
    const id = await db.transaction(async (tx) => {
      const newId = await insertService(tx, {
        slug: input.slug,
        draft,
        sortOrder: await nextServiceSortOrder(tx),
        updatedBy: actor.userId,
      })
      await syncMediaUsages(tx, "service", newId, draft)
      await writeAudit(tx, actor, {
        action: "service.created",
        entityType: "service",
        entityId: newId,
        diff: { slug: input.slug },
      })
      return newId
    })
    return toDto((await findServiceForEdit(db, id))!)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
    throw err
  }
}

export async function saveServiceDraft(
  actor: Actor,
  id: string,
  input: { draft: unknown; version: number }
) {
  assertCan(actor, { service: ["update"] })
  return toDto(await saveDraft(getDb(), serviceStore, actor, id, input))
}

export async function publishService(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  assertCan(actor, { service: ["publish"] })
  return toDto(await publish(getDb(), serviceStore, actor, id, input))
}

export async function restoreService(
  actor: Actor,
  id: string,
  input: { revisionId: string; version: number }
) {
  assertCan(actor, { service: ["update"] })
  return toDto(await restoreRevision(getDb(), serviceStore, actor, id, input))
}

/** The address is a column, not draft content: it changes the public URL now. */
export async function changeServiceSlug(
  actor: Actor,
  id: string,
  input: { slug: string; version: number }
) {
  assertCan(actor, { service: ["update"] })
  const db = getDb()
  try {
    const { before, after } = await db.transaction(async (tx) => {
      const existing = await findServiceForEdit(tx, id)
      if (!existing) throw notFound("Service")
      const updated = await updateServiceIfVersion(tx, id, input.version, {
        slug: input.slug,
        updatedBy: actor.userId,
      })
      if (!updated) {
        const current = await findServiceForEdit(tx, id)
        if (!current) throw notFound("Service")
        throw conflict(toDto(current))
      }
      await writeAudit(tx, actor, {
        action: "service.slug_changed",
        entityType: "service",
        entityId: id,
        diff: { from: existing.slug, to: input.slug },
      })
      if (existing.published !== null && existing.slug !== input.slug)
        await recordMove(tx, actor, {
          from: `/services/${existing.slug}`,
          to: `/services/${input.slug}`,
          reason: "service.slug_changed",
        })
      return { before: existing, after: updated }
    })
    invalidate(tag.services, tag.service(before.slug), tag.service(after.slug))
    return toDto(after)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
    throw err
  }
}

export async function deleteService(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  assertCan(actor, { service: ["delete"] })
  const removed = await getDb().transaction(async (tx) => {
    const existing = await findServiceForEdit(tx, id)
    if (!existing) throw notFound("Service")
    if (existing.version !== input.version) throw conflict(toDto(existing))
    await clearMediaUsages(tx, "service", id)
    // Versioned DELETE: a save that lands after the read above → 409.
    if (!(await deleteServiceIfVersion(tx, id, input.version))) {
      const current = await findServiceForEdit(tx, id)
      if (!current) throw notFound("Service")
      throw conflict(toDto(current))
    }
    await writeAudit(tx, actor, {
      action: "service.deleted",
      entityType: "service",
      entityId: id,
      diff: { slug: existing.slug },
    })
    if (existing.published !== null)
      await recordMove(tx, actor, {
        from: `/services/${existing.slug}`,
        to: "/services",
        reason: "service.deleted",
      })
    return existing
  })
  invalidate(tag.services, tag.service(removed.slug))
  return { ok: true as const }
}
