import "server-only"

import type {
  ApplicationFileKind,
  StoredFile,
} from "@/lib/schemas/api/applications"
import type { DocumentMime } from "@/server/lib/document-sniff"
import { getStorage, storageFor } from "@/server/lib/storage"

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
    name: safeFileName(file.name, `${kind}.${EXTENSIONS[file.mime]}`),
    mime: file.mime,
    size: file.bytes.length,
    driver: storage.name,
  }
}

/** Removes the stored objects; a failure is logged (the key, never the applicant). */
export async function deleteApplicationFiles(
  files: readonly (StoredFile | null | undefined)[]
): Promise<void> {
  for (const file of files) {
    if (!file) continue
    try {
      const storage = await storageFor(file.driver)
      if (!storage) {
        console.error(
          `[applications] storage for ${file.key} is not configured; file left behind`
        )
        continue
      }
      await storage.delete(file.key)
    } catch (err) {
      console.error(
        `[applications] could not delete ${file.key} (${err instanceof Error ? err.name : "unknown error"})`
      )
    }
  }
}

export async function openApplicationFile(file: StoredFile) {
  const storage = await storageFor(file.driver)
  return storage ? storage.stream(file.key) : null
}
