import "server-only"

import { z } from "zod"

import {
  type BuilderDocument,
  DraftDocument,
  emptyBlock,
  validateDocument,
} from "@/blocks/document"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import {
  BUILDER_ENTITY,
  type BuilderDraftInput,
  type BuilderMetaInput,
  type BuilderPageDto,
  type BuilderPageListItem,
  builderPath,
  type NewBuilderPageInput,
} from "@/lib/schemas/api/builder-pages"
import { type DbOrTx, getDb } from "@/server/db/client"
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
  versionedDto,
  type VersionedStore,
} from "@/server/lib/versioning"
import { recordMove } from "@/server/modules/redirects/service"

import * as repo from "./repo"

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toDto(row: repo.BuilderPageRow): BuilderPageDto {
  const versioned = versionedDto<DraftDocument>(row)
  return {
    ...versioned,
    published: versioned.published as BuilderDocument | null,
    id: row.id,
    slug: row.slug,
    title: row.title,
    path: builderPath(row.slug),
    seo: row.seo,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Publish runs the full document rules (validateDocument); its errors keep
 * their "blocks.<i>.<path>" keys through validateContent's 422.
 */
const publishable = z.unknown().transform((value, ctx): DraftDocument => {
  const result = validateDocument(value)
  if (result.ok) return result.doc
  for (const [key, messages] of Object.entries(result.fieldErrors))
    for (const message of messages)
      ctx.addIssue({
        code: "custom",
        message,
        path: key === "document" ? [] : key.split("."),
      })
  return z.NEVER
})

/** Versioning adapter: drafts are loose (autosave), publish is strict. */
const draftStore: VersionedStore<DraftDocument, repo.BuilderPageRow> = {
  entityType: BUILDER_ENTITY,
  label: "Page",
  schema: () => DraftDocument,
  find: (db, id) => repo.findBuilderPageForEdit(db, id),
  update: (db, id, version, patch) =>
    repo.updateBuilderPageIfVersion(db, id, version, patch),
  tags: (row) => [tag.builderPages, tag.builderPage(row.slug)],
  mediaValues: (row) => [row.draft, row.published, { seo: row.seo }],
  present: (row) => toDto(row),
}
const publishStore: VersionedStore<DraftDocument, repo.BuilderPageRow> = {
  ...draftStore,
  schema: () => publishable,
}

async function loadRow(db: DbOrTx, id: string) {
  const row = await repo.findBuilderPageForEdit(db, id)
  if (!row) throw notFound("Page")
  return row
}

const slugTaken = () =>
  new AppError("CONFLICT", "Another page already uses this address", {
    fieldErrors: { slug: ["Already used by another page"] },
  })

const mapUnique = (err: unknown): never => {
  if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
  throw err
}

// ---------------------------------------------------------------- reads

export async function listBuilderPages(
  actor: Actor
): Promise<BuilderPageListItem[]> {
  assertCan(actor, { page: ["read"] })
  const rows = await repo.listBuilderPageSummaries(getDb())
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    path: builderPath(row.slug),
    status: row.status,
    hasUnpublishedChanges: row.dirty,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedByName,
  }))
}

export async function getBuilderPage(
  actor: Actor,
  id: string
): Promise<BuilderPageDto> {
  assertCan(actor, { page: ["read"] })
  return toDto(await loadRow(getDb(), id))
}

// ---------------------------------------------------------------- writes

/**
 * A new draft page at /p/<slug>: the seed (a copied fixed page's blocks)
 * or one empty page hero. Fixed pages are never touched.
 */
export async function createBuilderPage(
  actor: Actor,
  input: NewBuilderPageInput,
  seed?: DraftDocument
): Promise<BuilderPageDto> {
  assertCan(actor, { page: ["create"] })
  const seeded = (seed?.blocks.length ?? 0) > 0
  // The route already parsed `seed`; parsing again keeps direct service
  // callers (seed scripts, D5.5 copy) behind the same draft rules.
  const draft: DraftDocument =
    seed && seeded
      ? DraftDocument.parse(seed)
      : { blocks: [emptyBlock("hero.page", { blocks: [] })] }
  const db = getDb()
  try {
    const id = await db.transaction(async (tx) => {
      const newId = await repo.insertBuilderPage(tx, {
        slug: input.slug,
        title: input.title,
        draft,
        createdBy: actor.userId,
      })
      await syncMediaUsages(tx, BUILDER_ENTITY, newId, draft)
      await writeAudit(tx, actor, {
        action: `${BUILDER_ENTITY}.created`,
        entityType: BUILDER_ENTITY,
        entityId: newId,
        diff: { slug: input.slug, title: input.title, seeded },
      })
      return newId
    })
    // A previewer may have cached "nothing at /p/<slug>" before the page
    // existed (review D5.4 M5): expire it so the new draft shows at once.
    invalidate(tag.builderPages, tag.builderPage(input.slug))
    return toDto(await loadRow(db, id))
  } catch (err) {
    return mapUnique(err)
  }
}

/** Autosave: loose DraftDocument; media_usages follow every save. */
export async function saveBuilderDraft(
  actor: Actor,
  id: string,
  input: BuilderDraftInput
): Promise<BuilderPageDto> {
  assertCan(actor, { page: ["update"] })
  return toDto(await saveDraft(getDb(), draftStore, actor, id, input))
}

/** validateDocument → 422 fieldErrors; revision row; expires the page's tags. */
export async function publishBuilderPage(
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<BuilderPageDto> {
  assertCan(actor, { page: ["publish"] })
  return toDto(await publish(getDb(), publishStore, actor, id, input))
}

export async function restoreBuilderPage(
  actor: Actor,
  id: string,
  input: { version: number; revisionId: string }
): Promise<BuilderPageDto> {
  assertCan(actor, { page: ["update"] })
  return toDto(await restoreRevision(getDb(), draftStore, actor, id, input))
}

/**
 * Title and address are columns: they change the live page at once. A
 * published page that moves gets a 301 from its old address.
 */
export async function changeBuilderMeta(
  actor: Actor,
  id: string,
  input: BuilderMetaInput
): Promise<BuilderPageDto> {
  assertCan(actor, { page: ["update"] })
  try {
    const { before, after, moved, changed } = await getDb().transaction(
      async (tx) => {
        const row = await loadRow(tx, id)
        if (row.version !== input.version) throw conflict(toDto(row))
        const patch: repo.BuilderPagePatch = { updatedBy: actor.userId }
        if (input.title !== undefined && input.title !== row.title)
          patch.title = input.title
        if (input.slug !== undefined && input.slug !== row.slug)
          patch.slug = input.slug
        // Nothing changes: no version bump, no audit, no invalidation.
        if (patch.title === undefined && patch.slug === undefined)
          return { before: row, after: row, moved: false, changed: false }
        const updated = await repo.updateBuilderPageIfVersion(
          tx,
          id,
          input.version,
          patch
        )
        if (!updated) throw conflict(toDto(await loadRow(tx, id)))
        await writeAudit(tx, actor, {
          action: `${BUILDER_ENTITY}.meta_changed`,
          entityType: BUILDER_ENTITY,
          entityId: id,
          diff: {
            from: { slug: row.slug, title: row.title },
            to: { slug: updated.slug, title: updated.title },
          },
        })
        const moved =
          row.published !== null &&
          updated.slug !== row.slug &&
          (await recordMove(tx, actor, {
            from: builderPath(row.slug),
            to: builderPath(updated.slug),
            reason: `${BUILDER_ENTITY}.slug_changed`,
          }))
        return { before: row, after: updated, moved, changed: true }
      }
    )
    if (changed && before.published !== null)
      invalidate(
        tag.builderPages,
        tag.builderPage(before.slug),
        ...(after.slug !== before.slug ? [tag.builderPage(after.slug)] : []),
        ...(moved ? [tag.redirects] : [])
      )
    return toDto(after)
  } catch (err) {
    return mapUnique(err)
  }
}

/**
 * Removes the page and its usages. `redirectHome` adds a 301 /p/<slug> → /
 * (and re-points redirects that led to the page) only for a page that was
 * published: a never-public address has no links to keep, and other
 * people's pre-staged redirects to it must stay as they are.
 */
export async function deleteBuilderPage(
  actor: Actor,
  id: string,
  input: { redirectHome: boolean }
): Promise<void> {
  assertCan(actor, { page: ["delete"] })
  const { removed, moved } = await getDb().transaction(async (tx) => {
    // Row lock first: a concurrent draft save (which syncs usages while it
    // holds the row) commits before we clear, or waits and then 404s.
    const row = await repo.lockBuilderPage(tx, id)
    if (!row) throw notFound("Page")
    await clearMediaUsages(tx, BUILDER_ENTITY, id)
    if (!(await repo.deleteBuilderPageRow(tx, id))) throw notFound("Page")
    await writeAudit(tx, actor, {
      action: `${BUILDER_ENTITY}.deleted`,
      entityType: BUILDER_ENTITY,
      entityId: id,
      diff: {
        slug: row.slug,
        version: row.version,
        redirectHome: input.redirectHome,
      },
    })
    const moved =
      input.redirectHome &&
      row.published !== null &&
      (await recordMove(tx, actor, {
        from: builderPath(row.slug),
        to: "/",
        reason: `${BUILDER_ENTITY}.deleted`,
      }))
    return { removed: row, moved }
  })
  if (removed.published !== null || moved)
    invalidate(
      tag.builderPages,
      tag.builderPage(removed.slug),
      ...(moved ? [tag.redirects] : [])
    )
}
