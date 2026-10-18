import "server-only"

import { isEditableSettingsKey } from "@/lib/admin/settings-keys"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type {
  RevisionDetail,
  RevisionEntity,
  RevisionSummary,
} from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden, notFound } from "@/server/lib/errors"

import { findRevision, listRevisionRows } from "./repo"

/** Read permission needed to see an entity's history. */
const READ: Record<RevisionEntity, PermissionRequest> = {
  page: { page: ["read"] },
  service: { service: ["read"] },
  article: { article: ["read"] },
  settings: { settings: ["read"] },
  team: { collection: ["read"] },
  client: { collection: ["read"] },
  groupCompany: { collection: ["read"] },
  category: { collection: ["read"] },
}

/**
 * Settings history is limited to the content keys edited in Settings
 * (lib/admin/settings-keys.ts): other settings rows (integrations, and the
 * Phase 8 marketing/SEO keys until that phase extends this list) are never
 * served here, whatever their revision rows contain.
 */
function assertCanRead(actor: Actor, entity: RevisionEntity, entityId: string) {
  if (!hasPermission(actor.roles, READ[entity])) throw forbidden()
  if (entity === "settings" && !isEditableSettingsKey(entityId))
    throw notFound("Revision")
}

const summary = (row: {
  id: string
  version: number
  createdAt: Date
  actorId: string | null
  actorName: string | null
}): RevisionSummary => ({
  id: row.id,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  actor:
    row.actorId && row.actorName
      ? { id: row.actorId, name: row.actorName }
      : null,
})

/** Newest first, at most 50 (Phase 5 prunes older rows). */
export async function listRevisions(
  actor: Actor,
  entity: RevisionEntity,
  entityId: string
): Promise<{ items: RevisionSummary[] }> {
  assertCanRead(actor, entity, entityId)
  const rows = await listRevisionRows(getDb(), entity, entityId)
  return { items: rows.map(summary) }
}

export async function getRevision(
  actor: Actor,
  entity: RevisionEntity,
  entityId: string,
  revisionId: string
): Promise<RevisionDetail> {
  assertCanRead(actor, entity, entityId)
  const row = await findRevision(getDb(), revisionId)
  if (!row || row.entityType !== entity || row.entityId !== entityId)
    throw notFound("Revision")
  return { ...summary(row), data: row.data }
}
