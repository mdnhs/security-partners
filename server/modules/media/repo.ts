import "server-only"

import { eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { media } from "@/server/db/schema"

export async function findMediaById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id))
  return row ?? null
}
