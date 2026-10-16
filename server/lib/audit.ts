import "server-only"

import type { DbOrTx } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import {
  findLatestEntityAudit,
  insertAudit,
  updateAuditDiff,
} from "@/server/modules/audit/repo"

export type AuditEntry = {
  action: string
  entityType?: string
  entityId?: string
  diff?: unknown
  /** Request origin when there is no actor (failed sign-in, password reset by token). */
  ip?: string | null
  userAgent?: string | null
}

/**
 * Appends one audit row. Pass the transaction (`tx`) when the audited change
 * runs in one, so the row commits or rolls back with it.
 */
export async function writeAudit(
  db: DbOrTx,
  actor: Actor | null,
  entry: AuditEntry
): Promise<void> {
  await insertAudit(db, {
    actorId: actor?.userId ?? null,
    impersonatorId: actor?.impersonatorId ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    ip: actor?.ip ?? entry.ip ?? null,
    userAgent: actor?.userAgent ?? entry.userAgent ?? null,
    diff: entry.diff ?? null,
  })
}

/** Repeated draft saves within this window share one audit row. */
export const AUDIT_COALESCE_WINDOW_MS = 10 * 60 * 1000

type CoalescedDiff = { saves?: unknown }

/**
 * Autosave would flood the log, so a save updates the entity's newest audit
 * row instead of appending when that row is the same action by the same
 * actor (and impersonator) created within the window: its diff becomes
 * `{ ...entry.diff, saves, lastSavedAt }`, createdAt stays the first save.
 * Any other row in between (a publish, another editor) starts a new row.
 */
export async function writeCoalescedAudit(
  db: DbOrTx,
  actor: Actor,
  entry: AuditEntry & { entityType: string; entityId: string },
  now = new Date()
): Promise<void> {
  const latest = await findLatestEntityAudit(
    db,
    entry.entityType,
    entry.entityId,
    new Date(now.getTime() - AUDIT_COALESCE_WINDOW_MS)
  )
  const base = (entry.diff ?? {}) as Record<string, unknown>
  const lastSavedAt = now.toISOString()
  if (
    latest &&
    latest.action === entry.action &&
    latest.actorId === actor.userId &&
    latest.impersonatorId === actor.impersonatorId
  ) {
    const previous = (latest.diff as CoalescedDiff | null)?.saves
    const saves = (typeof previous === "number" ? previous : 1) + 1
    await updateAuditDiff(db, latest.id, { ...base, saves, lastSavedAt })
    return
  }
  await writeAudit(db, actor, {
    ...entry,
    diff: { ...base, saves: 1, lastSavedAt },
  })
}
