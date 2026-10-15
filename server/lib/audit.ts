import "server-only"

import type { DbOrTx } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { insertAudit } from "@/server/modules/audit/repo"

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
