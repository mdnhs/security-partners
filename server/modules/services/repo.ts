import "server-only"

import { asc, eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { services } from "@/server/db/schema"

export function listServiceRows(db: DbOrTx) {
  return db
    .select()
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.slug))
}

export async function findServiceBySlug(db: DbOrTx, slug: string) {
  const [row] = await db.select().from(services).where(eq(services.slug, slug))
  return row ?? null
}

export async function findServiceById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(services).where(eq(services.id, id))
  return row ?? null
}
