import "server-only"

import { type DbOrTx, getDb } from "@/server/db/client"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { diskStorage } from "./disk"
import { r2Storage } from "./r2"
import type { StorageDriver } from "./types"

export { defaultUploadsRoot, diskStorage } from "./disk"
export {
  decodeKeyPath,
  encodeKeyPath,
  IMMUTABLE_CACHE,
  isValidKey,
  keySegments,
  MEDIA_FILE_PATH,
  mediaFileUrl,
  mediaUrl,
  resolveInside,
} from "./paths"
export { r2Storage } from "./r2"
export { STATIC_PREFIX, staticFilePath } from "./static"
export type { StorageDriver, StorageName } from "./types"

/** Driver for new uploads: R2 once integrations.r2 is saved, else the server disk (Review Focus 3). */
export async function getStorage(db: DbOrTx = getDb()): Promise<StorageDriver> {
  const r2 = await readIntegrationConfig("integrations.r2", db)
  return r2 ? r2Storage(r2) : diskStorage()
}

/** Driver holding an existing row's file; null for static rows, or R2 rows once R2 is gone. */
export async function storageFor(
  driver: "static" | "disk" | "r2",
  db: DbOrTx = getDb()
): Promise<StorageDriver | null> {
  if (driver === "disk") return diskStorage()
  if (driver === "static") return null
  const r2 = await readIntegrationConfig("integrations.r2", db)
  return r2 ? r2Storage(r2) : null
}
