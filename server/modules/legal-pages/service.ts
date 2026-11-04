import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import {
  LEGAL_ENTITY,
  type LegalMetaInput,
  type LegalOrderInput,
  type LegalPageDto,
  type LegalPageListItem,
  legalPath,
  type NewLegalPageInput,
} from "@/lib/schemas/api/legal-pages"
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
import { findPageForEdit } from "@/server/modules/pages/repo"
import { recordMove } from "@/server/modules/redirects/service"
import { type LegalTemplate, legalTemplate } from "@/templates/legal/schema"

import * as repo from "./repo"

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toDto(row: repo.LegalPageRow): LegalPageDto {
  return {
    ...versionedDto<LegalTemplate>(row),
    id: row.id,
    slug: row.slug,
    title: row.title,
    path: legalPath(row.slug),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Versioning adapter: drafts and publishes satisfy the "legal" template. */
export const legalStore: VersionedStore<LegalTemplate, repo.LegalPageRow> = {
  entityType: LEGAL_ENTITY,
  label: "Legal page",
  schema: () => legalTemplate,
  find: (db, id) => repo.findLegalPageForEdit(db, id),
  update: (db, id, version, patch) =>
    repo.updateLegalPageIfVersion(db, id, version, patch),
  // The footer lists published pages, so every publish expires it too.
  tags: (row) => [tag.legalPages, tag.legalPage(row.slug)],
  mediaValues: (row) => [row.draft, row.published],
  present: (row) => toDto(row),
}

async function loadRow(db: DbOrTx, id: string) {
  const row = await repo.findLegalPageForEdit(db, id)
  if (!row) throw notFound("Legal page")
  return row
}

const slugTaken = () =>
  new AppError("CONFLICT", "Another page already uses this address", {
    fieldErrors: { slug: ["Already used by another legal page"] },
  })

const mapUnique = (err: unknown): never => {
  if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
  throw err
}

/**
 * A redirect that starts at the new address would be shadowed (or deleted by
 * recordMove): refuse and name it, so the admin can remove it deliberately.
 */
async function assertNoRedirectAt(db: DbOrTx, slug: string) {
  const path = legalPath(slug)
  const hit = await repo.findRedirectAt(db, path)
  if (hit)
    throw new AppError(
      "CONFLICT",
      `A redirect from ${path} to ${hit.toPath} already exists`,
      {
        fieldErrors: {
          slug: [
            `${path} is already redirected to ${hit.toPath}. Remove that redirect first (SEO › Redirects).`,
          ],
        },
      }
    )
}

/**
 * The first draft of a new page: the fixed Privacy page's banner picture (a
 * valid image is required), the new title, one line to replace. It passes the
 * "legal" template, which every saved draft must.
 */
async function starterDraft(db: DbOrTx, title: string): Promise<LegalTemplate> {
  const privacy = await findPageForEdit(db, "privacy")
  const source = legalTemplate.safeParse(privacy?.published ?? privacy?.draft)
  if (!source.success)
    throw new AppError(
      "VALIDATION_FAILED",
      "Finish the Privacy page first: its banner image is the starting point for new legal pages",
      { fieldErrors: {} }
    )
  return {
    hero: {
      image: source.data.hero.image,
      crumb: title,
      title,
      description: "Please read this page carefully.",
    },
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Write the text of this page here." },
          ],
        },
      ],
    },
  }
}

// ---------------------------------------------------------------- reads

export async function listLegalPages(
  actor: Actor
): Promise<LegalPageListItem[]> {
  assertCan(actor, { page: ["read"] })
  const rows = await repo.listLegalPageSummaries(getDb())
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    path: legalPath(row.slug),
    status: row.status,
    hasUnpublishedChanges: row.dirty,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedByName,
  }))
}

export async function getLegalPage(
  actor: Actor,
  id: string
): Promise<LegalPageDto> {
  assertCan(actor, { page: ["read"] })
  return toDto(await loadRow(getDb(), id))
}

// ---------------------------------------------------------------- writes

/** A new draft page at /<slug>, last in the footer. */
export async function createLegalPage(
  actor: Actor,
  input: NewLegalPageInput
): Promise<LegalPageDto> {
  assertCan(actor, { page: ["create"] })
  const db = getDb()
  try {
    const id = await db.transaction(async (tx) => {
      await assertNoRedirectAt(tx, input.slug)
      const draft = await starterDraft(tx, input.title)
      const newId = await repo.insertLegalPage(tx, {
        slug: input.slug,
        title: input.title,
        draft,
        sortOrder: await repo.nextSortOrder(tx),
        createdBy: actor.userId,
      })
      await syncMediaUsages(tx, LEGAL_ENTITY, newId, draft)
      await writeAudit(tx, actor, {
        action: `${LEGAL_ENTITY}.created`,
        entityType: LEGAL_ENTITY,
        entityId: newId,
        diff: { slug: input.slug, title: input.title },
      })
      return newId
    })
    // A previewer may have cached "nothing at /<slug>" before the page existed.
    invalidate(tag.legalPages, tag.legalPage(input.slug))
    return toDto(await loadRow(db, id))
  } catch (err) {
    return mapUnique(err)
  }
}

export async function saveLegalDraft(
  actor: Actor,
  id: string,
  input: { draft: unknown; version: number }
): Promise<LegalPageDto> {
  assertCan(actor, { page: ["update"] })
  return toDto(await saveDraft(getDb(), legalStore, actor, id, input))
}

/** Copies the draft live (published_at = the page's "last updated"). */
export async function publishLegalPage(
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<LegalPageDto> {
  assertCan(actor, { page: ["publish"] })
  return toDto(await publish(getDb(), legalStore, actor, id, input))
}

export async function restoreLegalPage(
  actor: Actor,
  id: string,
  input: { version: number; revisionId: string }
): Promise<LegalPageDto> {
  assertCan(actor, { page: ["update"] })
  return toDto(await restoreRevision(getDb(), legalStore, actor, id, input))
}

/**
 * Title and address are columns: they change the live page at once. A
 * published page that moves gets a 301 from its old address. Neither bumps
 * the "last updated" date (that is publish).
 */
export async function changeLegalMeta(
  actor: Actor,
  id: string,
  input: LegalMetaInput
): Promise<LegalPageDto> {
  assertCan(actor, { page: ["update"] })
  try {
    const { before, after, moved, changed } = await getDb().transaction(
      async (tx) => {
        const row = await loadRow(tx, id)
        if (row.version !== input.version) throw conflict(toDto(row))
        const patch: repo.LegalPagePatch = { updatedBy: actor.userId }
        if (input.title !== undefined && input.title !== row.title)
          patch.title = input.title
        if (input.slug !== undefined && input.slug !== row.slug)
          patch.slug = input.slug
        if (patch.title === undefined && patch.slug === undefined)
          return { before: row, after: row, moved: false, changed: false }
        if (patch.slug !== undefined) await assertNoRedirectAt(tx, patch.slug)
        const updated = await repo.updateLegalPageIfVersion(
          tx,
          id,
          input.version,
          patch
        )
        if (!updated) throw conflict(toDto(await loadRow(tx, id)))
        await writeAudit(tx, actor, {
          action: `${LEGAL_ENTITY}.meta_changed`,
          entityType: LEGAL_ENTITY,
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
            from: legalPath(row.slug),
            to: legalPath(updated.slug),
            reason: `${LEGAL_ENTITY}.slug_changed`,
          }))
        return { before: row, after: updated, moved, changed: true }
      }
    )
    if (changed)
      invalidate(
        tag.legalPages,
        tag.legalPage(before.slug),
        ...(after.slug !== before.slug ? [tag.legalPage(after.slug)] : []),
        ...(moved ? [tag.redirects] : [])
      )
    return toDto(after)
  } catch (err) {
    return mapUnique(err)
  }
}

/** The footer order: `ids` must be exactly the existing pages. */
export async function reorderLegalPages(
  actor: Actor,
  input: LegalOrderInput
): Promise<LegalPageListItem[]> {
  assertCan(actor, { page: ["update"] })
  await getDb().transaction(async (tx) => {
    const existing = new Set((await repo.listLegalPageIds(tx)).map((r) => r.id))
    const wanted = new Set(input.ids)
    if (
      wanted.size !== input.ids.length ||
      wanted.size !== existing.size ||
      input.ids.some((id) => !existing.has(id))
    )
      throw new AppError(
        "VALIDATION_FAILED",
        "The list changed while you were sorting it. Reload and try again.",
        { fieldErrors: {} }
      )
    for (const [index, id] of input.ids.entries())
      await repo.setSortOrder(tx, id, index)
    await writeAudit(tx, actor, {
      action: `${LEGAL_ENTITY}.reordered`,
      entityType: LEGAL_ENTITY,
      diff: { ids: input.ids },
    })
  })
  invalidate(tag.legalPages)
  return listLegalPages(actor)
}

/**
 * Removes the page and its media usages. A published page leaves the footer
 * at once; its address simply stops existing (a real 404).
 */
export async function deleteLegalPage(actor: Actor, id: string): Promise<void> {
  assertCan(actor, { page: ["delete"] })
  const removed = await getDb().transaction(async (tx) => {
    const row = await repo.lockLegalPage(tx, id)
    if (!row) throw notFound("Legal page")
    await clearMediaUsages(tx, LEGAL_ENTITY, id)
    if (!(await repo.deleteLegalPageRow(tx, id))) throw notFound("Legal page")
    await writeAudit(tx, actor, {
      action: `${LEGAL_ENTITY}.deleted`,
      entityType: LEGAL_ENTITY,
      entityId: id,
      diff: { slug: row.slug, version: row.version },
    })
    return row
  })
  invalidate(tag.legalPages, tag.legalPage(removed.slug))
}
