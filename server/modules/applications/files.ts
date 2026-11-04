import "server-only"

import type {
  ApplicationFileKind,
  StoredFile,
} from "@/lib/schemas/api/applications"
import type { DocumentMime } from "@/server/lib/document-sniff"
import { getDb } from "@/server/db/client"
import { getStorage, storageFor } from "@/server/lib/storage"
import { insertKeyedJobIfAbsent } from "@/server/modules/jobs/repo"

/** The retry job for a stored object that could not be deleted at once. */
export const DELETE_APPLICATION_FILE_JOB = "delete-application-file"
const RETRY_AFTER_MS = 60 * 60_000

/** Queues `file` for deletion by the scheduler (it retries until it succeeds). */
async function retryDelete(file: StoredFile) {
  await insertKeyedJobIfAbsent(getDb(), {
    name: DELETE_APPLICATION_FILE_JOB,
    key: `application-file:${file.key}`,
    runAt: new Date(Date.now() + RETRY_AFTER_MS),
    payload: { key: file.key, driver: file.driver },
  })
}

const EXTENSIONS: Record<DocumentMime, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
}

/** applications/<id>/<cv|psa-card>.<ext>: private, never a media row (the public file route cannot serve it). */
export const applicationFileKey = (
  applicationId: string,
  kind: ApplicationFileKind,
  mime: DocumentMime
) => `applications/${applicationId}/${kind}.${EXTENSIONS[mime]}`

/** A file name safe for storage and Content-Disposition: no paths, no control characters. */
export function safeFileName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  const clean = base
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim()
    .slice(0, 120)
  return clean || fallback
}

function withExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base}.${ext}`
}

export async function putApplicationFile(
  applicationId: string,
  kind: ApplicationFileKind,
  file: { bytes: Uint8Array; mime: DocumentMime; name: string }
): Promise<StoredFile> {
  const storage = await getStorage()
  const key = applicationFileKey(applicationId, kind, file.mime)
  await storage.put(key, file.bytes, file.mime)
  return {
    key,
    // The extension follows the sniffed type, never the applicant's: an OLE
    // file named setup.msi downloads as setup.doc and opens in Word.
    name: withExtension(safeFileName(file.name, kind), EXTENSIONS[file.mime]),
    mime: file.mime,
    size: file.bytes.length,
    driver: storage.name,
  }
}

/**
 * Removes the stored objects. One that cannot be deleted now (storage error,
 * or its storage not configured) is queued for the scheduler, so an erased
 * or expired application never leaves its CV behind. Logs name the key only.
 */
export async function deleteApplicationFiles(
  files: readonly (StoredFile | null | undefined)[]
): Promise<void> {
  for (const file of files) {
    if (!file) continue
    try {
      const storage = await storageFor(file.driver)
      if (!storage) throw new Error("storage not configured")
      await storage.delete(file.key)
    } catch (err) {
      console.error(
        `[applications] could not delete ${file.key} now (${err instanceof Error ? err.message : "unknown error"}); retry queued`
      )
      await retryDelete(file).catch((queueErr) =>
        console.error(
          `[applications] could not queue the retry for ${file.key}`,
          queueErr
        )
      )
    }
  }
}

/** The retry job's work: delete one object; throws (scheduler retries) on failure. */
export async function deleteQueuedApplicationFile(
  payload: unknown
): Promise<{ warning?: string }> {
  const p = payload as { key?: unknown; driver?: unknown } | null
  if (
    typeof p?.key !== "string" ||
    !p.key.startsWith("applications/") ||
    (p.driver !== "disk" && p.driver !== "r2")
  )
    return { warning: "Unreadable application-file job; nothing deleted" }
  const storage = await storageFor(p.driver)
  if (!storage) throw new Error(`storage ${p.driver} is not configured`)
  await storage.delete(p.key)
  return {}
}

export async function openApplicationFile(file: StoredFile) {
  const storage = await storageFor(file.driver)
  return storage ? storage.stream(file.key) : null
}
