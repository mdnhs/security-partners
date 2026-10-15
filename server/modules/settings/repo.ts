import "server-only"

import { eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { settings } from "@/server/db/schema"

export async function findSettingsRow(db: DbOrTx, key: string) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  return row ?? null
}
