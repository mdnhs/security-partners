import "server-only"

import { hasPermission } from "@/lib/auth/permissions"
import type { AuditListQuery } from "@/lib/schemas/api/audit"
import type { Paginated } from "@/lib/schemas/api/list"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden } from "@/server/lib/errors"

import { listAudit } from "./repo"

export type AuditItem = {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  actor: { id: string; name: string | null; email: string | null } | null
  impersonatorId: string | null
  ip: string | null
  userAgent: string | null
  diff: unknown
  createdAt: string
}

export async function listAuditLog(
  actor: Actor,
  query: AuditListQuery
): Promise<Paginated<AuditItem>> {
  if (!hasPermission(actor.roles, { audit: ["read"] })) throw forbidden()
  const { rows, total } = await listAudit(getDb(), {
    filters: {
      actorId: query.actor,
      action: query.action,
      entityType: query.entityType,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      q: query.q || undefined,
    },
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actor: row.actorId
        ? { id: row.actorId, name: row.actorName, email: row.actorEmail }
        : null,
      impersonatorId: row.impersonatorId,
      ip: row.ip,
      userAgent: row.userAgent,
      diff: row.diff,
      createdAt: row.createdAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}
