import "server-only"

import { hasPermission } from "@/lib/auth/permissions"
import type { Reorderable } from "@/lib/schemas/api/collections"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { conflict, forbidden } from "@/server/lib/errors"

import { applyOrder, orderedIds } from "./repo"

const TAGS: Record<Reorderable, string> = {
  services: tag.services,
  team: tag.team,
  clients: tag.clients,
  "group-companies": tag.groupCompanies,
  categories: tag.categories,
}

/**
 * Persists a drag-and-drop order (sortOrder = index). `ids` must list
 * exactly the current records; otherwise someone added or removed one
 * meanwhile → 409 with the current order.
 */
export async function reorder(
  actor: Actor,
  collection: Reorderable,
  ids: string[]
) {
  const permitted =
    collection === "services"
      ? hasPermission(actor.roles, { service: ["update"] })
      : hasPermission(actor.roles, { collection: ["update"] })
  if (!permitted) throw forbidden()
  await getDb().transaction(async (tx) => {
    const current = await orderedIds(tx, collection)
    const same =
      current.length === ids.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => current.includes(id))
    if (!same) throw conflict({ ids: current })
    await applyOrder(tx, collection, ids)
    await writeAudit(tx, actor, {
      action: `${collection}.reordered`,
      entityType: collection,
      diff: { ids },
    })
  })
  invalidate(TAGS[collection])
  return { ids }
}
