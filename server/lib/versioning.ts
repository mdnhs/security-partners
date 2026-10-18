import "server-only"

import type { z } from "zod"

import { isDeepEqual } from "@/lib/json"
import type { ContentStatus, VersionedDto } from "@/lib/schemas/api/content"
import type { Db, DbOrTx } from "@/server/db/client"
import {
  findRevision,
  insertRevision,
  nextRevisionVersion,
} from "@/server/modules/revisions/repo"

import type { Actor } from "./actor"
import { writeAudit, writeCoalescedAudit } from "./audit"
import { invalidate } from "./cache-tags"
import { AppError, conflict, fieldErrorsFromIssues, notFound } from "./errors"
import { syncMediaUsages } from "./media-usages"
import { pgErrorCode, UNIQUE_VIOLATION } from "./pg-errors"

export type { ContentStatus }

/** Spec §5.1 versioning columns (pages, services, articles, settings). */
export type Versioned<T> = {
  draft: T
  published: T | null
  version: number
  status: ContentStatus
  scheduledAt: Date | null
  publishedAt: Date | null
}

/** A versioned row as a store returns it. */
export type VersionedRecord<T> = Versioned<T> & {
  updatedAt: Date
  updatedBy: string | null
  updatedByName: string | null
}

export type VersionedPatch<T> = {
  draft?: T
  published?: T | null
  status?: ContentStatus
  publishedAt?: Date | null
  updatedBy: string
}

/** Storage adapter for one versioned entity type (implemented in its module). */
export type VersionedStore<
  T,
  R extends VersionedRecord<T> = VersionedRecord<T>,
> = {
  /** revisions.entity_type, media_usages.entity_type, audit "<type>.<action>". */
  entityType: string
  /** For "<label> not found". */
  label: string
  /** Zod schema the draft must satisfy (pages: per template). */
  schema(record: R): z.ZodType<T>
  find(db: DbOrTx, id: string): Promise<R | null>
  /**
   * Applies `patch` and sets version = `version` + 1, only if the stored
   * version still equals `version`. Returns the updated row, or null when
   * the version is stale or the row is gone.
   */
  update(
    db: DbOrTx,
    id: string,
    version: number,
    patch: VersionedPatch<T>
  ): Promise<R | null>
  /** Cache tags to expire when this record is published. */
  tags(record: R): string[]
  /** Wire shape sent back with a 409 (the current state, Review Focus 2). */
  present(record: R): unknown
  /**
   * Values whose media refs this record uses (media_usages). Default:
   * draft + published. Pages, services and articles add their seo column
   * so a share image stays "in use".
   */
  mediaValues?(record: R): unknown[]
}

/** Wire fields shared by every versioned DTO (pages, services, settings). */
export function versionedDto<T>(row: VersionedRecord<T>): VersionedDto<T> {
  return {
    draft: row.draft,
    published: row.published,
    version: row.version,
    status: row.status,
    dirty: row.published === null || !isDeepEqual(row.draft, row.published),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy:
      row.updatedBy && row.updatedByName
        ? { id: row.updatedBy, name: row.updatedByName }
        : null,
  }
}

const mediaValuesOf = <T, R extends VersionedRecord<T>>(
  store: VersionedStore<T, R>,
  record: R
): unknown[] => store.mediaValues?.(record) ?? [record.draft, record.published]

/** Parses with the record's schema; 422 with field paths ("hero.heading"). */
export function validateContent<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success)
    throw new AppError("VALIDATION_FAILED", "Some fields need attention", {
      fieldErrors: fieldErrorsFromIssues(result.error.issues),
    })
  return result.data
}

async function requireRecord<T, R extends VersionedRecord<T>>(
  store: VersionedStore<T, R>,
  db: DbOrTx,
  id: string
): Promise<R> {
  const record = await store.find(db, id)
  if (!record) throw notFound(store.label)
  return record
}

/** After a failed versioned update: 404 if the row is gone, else 409 with the current state. */
async function staleOrMissing<T, R extends VersionedRecord<T>>(
  store: VersionedStore<T, R>,
  db: DbOrTx,
  id: string
): Promise<never> {
  const current = await requireRecord(store, db, id)
  throw conflict(store.present(current))
}

/**
 * Stale `version` → 409 with the current state before anything else is
 * checked, so a client holding old data never gets validation errors about
 * it. The versioned UPDATE still guards against races after this read.
 */
function assertCurrentVersion<T, R extends VersionedRecord<T>>(
  store: VersionedStore<T, R>,
  record: R,
  version: number
): void {
  if (record.version !== version) throw conflict(store.present(record))
}

/**
 * Autosave target: validates `draft`, writes it if `version` is current
 * (version + 1), keeps media_usages exact and audits. Never touches the
 * public site (no cache invalidation: drafts are read only in draft mode).
 */
export async function saveDraft<T, R extends VersionedRecord<T>>(
  db: Db,
  store: VersionedStore<T, R>,
  actor: Actor,
  id: string,
  input: { draft: unknown; version: number }
): Promise<R> {
  return db.transaction(async (tx) => {
    const existing = await requireRecord(store, tx, id)
    assertCurrentVersion(store, existing, input.version)
    const draft = validateContent(store.schema(existing), input.draft)
    const updated = await store.update(tx, id, input.version, {
      draft,
      updatedBy: actor.userId,
    })
    if (!updated) return staleOrMissing(store, tx, id)
    await syncMediaUsages(
      tx,
      store.entityType,
      id,
      ...mediaValuesOf(store, updated)
    )
    await writeCoalescedAudit(tx, actor, {
      action: `${store.entityType}.draft_saved`,
      entityType: store.entityType,
      entityId: id,
      diff: { version: updated.version },
    })
    return updated
  })
}

/**
 * Publish = copy draft → published, version + 1, revision row with the
 * published data, audit, then expire the record's cache tags (spec §5.1).
 */
export async function publish<T, R extends VersionedRecord<T>>(
  db: Db,
  store: VersionedStore<T, R>,
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<R> {
  let published: R
  try {
    published = await publishInTx(db, store, actor, id, input)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) {
      // The versioned UPDATE serialises publishes of one record (row lock).
      // If the record moved on, this was a lost race: 409 like any stale
      // version. Otherwise a leftover revision row holds this version — a
      // data fault, not a conflict the editor can resolve: log and 500.
      const current = await requireRecord(store, db, id)
      if (current.version !== input.version)
        throw conflict(store.present(current))
      console.error(
        `[versioning] ${store.entityType}/${id}: revision ${input.version + 1} already exists; publish rolled back`
      )
    }
    throw err
  }
  invalidate(...store.tags(published))
  return published
}

function publishInTx<T, R extends VersionedRecord<T>>(
  db: Db,
  store: VersionedStore<T, R>,
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<R> {
  return db.transaction(async (tx) => {
    const existing = await requireRecord(store, tx, id)
    assertCurrentVersion(store, existing, input.version)
    const data = validateContent(store.schema(existing), existing.draft)
    const updated = await store.update(tx, id, input.version, {
      draft: data,
      published: data,
      status: "published",
      publishedAt: new Date(),
      updatedBy: actor.userId,
    })
    if (!updated) return staleOrMissing(store, tx, id)
    await insertRevision(tx, {
      entityType: store.entityType,
      entityId: id,
      version: updated.version,
      data,
      actorId: actor.userId,
    })
    await syncMediaUsages(
      tx,
      store.entityType,
      id,
      ...mediaValuesOf(store, updated)
    )
    await writeAudit(tx, actor, {
      action: `${store.entityType}.published`,
      entityType: store.entityType,
      entityId: id,
      diff: { version: updated.version },
    })
    return updated
  })
}

/** Loads a revision's data into the draft (version + 1). Publishing stays a separate step. */
export async function restoreRevision<T, R extends VersionedRecord<T>>(
  db: Db,
  store: VersionedStore<T, R>,
  actor: Actor,
  id: string,
  input: { revisionId: string; version: number }
): Promise<R> {
  return db.transaction(async (tx) => {
    const existing = await requireRecord(store, tx, id)
    assertCurrentVersion(store, existing, input.version)
    const revision = await findRevision(tx, input.revisionId)
    if (
      !revision ||
      revision.entityType !== store.entityType ||
      revision.entityId !== id
    )
      throw notFound("Revision")
    const parsed = store.schema(existing).safeParse(revision.data)
    if (!parsed.success)
      throw new AppError(
        "VALIDATION_FAILED",
        `This version no longer fits the ${store.label.toLowerCase()}'s fields and cannot be restored`,
        { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) }
      )
    const updated = await store.update(tx, id, input.version, {
      draft: parsed.data,
      updatedBy: actor.userId,
    })
    if (!updated) return staleOrMissing(store, tx, id)
    await syncMediaUsages(
      tx,
      store.entityType,
      id,
      ...mediaValuesOf(store, updated)
    )
    await writeAudit(tx, actor, {
      action: `${store.entityType}.restored`,
      entityType: store.entityType,
      entityId: id,
      diff: { revisionId: revision.id, fromVersion: revision.version },
    })
    return updated
  })
}

/**
 * Revision row for records without a version column (team, clients, group
 * companies, categories): version = max + 1 in the caller's transaction
 * (ledger ruling; revisions are unique per entity + version).
 */
export async function snapshotRevision(
  tx: DbOrTx,
  actor: Actor,
  entityType: string,
  entityId: string,
  data: unknown
): Promise<number> {
  const version = await nextRevisionVersion(tx, entityType, entityId)
  await insertRevision(tx, {
    entityType,
    entityId,
    version,
    data,
    actorId: actor.userId,
  })
  return version
}
