import "server-only"

import { eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { pages } from "@/server/db/schema"

export async function findPageByKey(db: DbOrTx, key: string) {
  const [row] = await db.select().from(pages).where(eq(pages.key, key))
  return row ?? null
}
