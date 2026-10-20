import "server-only"

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { PageDto, PageListItem } from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { tag } from "@/server/lib/cache-tags"
import { forbidden, notFound } from "@/server/lib/errors"
import {
  publish,
  restoreRevision,
  saveDraft,
  versionedDto,
  type VersionedStore,
} from "@/server/lib/versioning"
import {
  isPageKey,
  PAGE_PATHS,
  PAGES,
  type PageKey,
  templateSchemaFor,
} from "@/templates/registry"

import {
  findPageForEdit,
  listPagesForEdit,
  type PageEditRow,
  updatePageIfVersion,
} from "./repo"

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toDto(row: PageEditRow): PageDto {
  const key = row.key as PageKey
  return {
    key,
    label: PAGE_LABELS[key],
    template: row.template,
    path: PAGE_PATHS[key],
    ...versionedDto<unknown>(row),
  }
}

/** Versioning adapter for pages (id = page key). */
export const pageStore: VersionedStore<unknown, PageEditRow> = {
  entityType: "page",
  label: "Page",
  schema: (row) => templateSchemaFor(row.key as PageKey),
  find: (db, key) => findPageForEdit(db, key),
  update: (db, key, version, patch) =>
    updatePageIfVersion(db, key, version, patch),
  tags: (row) => [tag.page(row.key)],
  mediaValues: (row) => [row.draft, row.published, { seo: row.seo }],
  present: (row) => toDto(row),
}

export async function listPages(
  actor: Actor
): Promise<{ items: PageListItem[] }> {
  assertCan(actor, { page: ["read"] })
  const rows = await listPagesForEdit(getDb())
  const order = Object.keys(PAGES)
  return {
    items: rows
      .filter((row) => isPageKey(row.key))
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((row) => {
        const dto: Partial<PageDto> = toDto(row)
        delete dto.draft
        delete dto.published
        return dto as PageListItem
      }),
  }
}

export async function getPage(actor: Actor, key: PageKey): Promise<PageDto> {
  assertCan(actor, { page: ["read"] })
  const row = await findPageForEdit(getDb(), key)
  if (!row) throw notFound("Page")
  return toDto(row)
}

export async function savePageDraft(
  actor: Actor,
  key: PageKey,
  input: { draft: unknown; version: number }
): Promise<PageDto> {
  assertCan(actor, { page: ["update"] })
  return toDto(await saveDraft(getDb(), pageStore, actor, key, input))
}

export async function publishPage(
  actor: Actor,
  key: PageKey,
  input: { version: number }
): Promise<PageDto> {
  assertCan(actor, { page: ["publish"] })
  return toDto(await publish(getDb(), pageStore, actor, key, input))
}

export async function restorePage(
  actor: Actor,
  key: PageKey,
  input: { revisionId: string; version: number }
): Promise<PageDto> {
  assertCan(actor, { page: ["update"] })
  return toDto(await restoreRevision(getDb(), pageStore, actor, key, input))
}
